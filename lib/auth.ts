import { and, eq, gt } from 'drizzle-orm';
import { getDb } from '@/db';
import { auditLogs, organizations, sessions, users } from '@/db/schema';

export type SessionUser = {
  id: number;
  organizationId: number;
  organizationName: string;
  name: string;
  email: string;
  role: 'master' | 'member';
  platformAdmin: boolean;
};

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const COOKIE_NAME = 'ar_session';
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const PBKDF2_ITERATIONS = 100_000;
const encoder = new TextEncoder();

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, iterationText, saltText, expectedText] = stored.split('$');
  if (algorithm !== 'pbkdf2' || !iterationText || !saltText || !expectedText) return false;
  const iterations = Number(iterationText);
  if (!Number.isInteger(iterations) || iterations < 50_000 || iterations > 500_000) return false;
  const actual = await derive(password, fromBase64(saltText), iterations);
  const expected = fromBase64(expectedText);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};

function readCookie(request: Request) {
  const cookies = request.headers.get('cookie') ?? '';
  for (const item of cookies.split(';')) {
    const [name, ...parts] = item.trim().split('=');
    if (name === COOKIE_NAME) return parts.join('=');
  }
  return null;
}

export const sessionCookie = (token: string) =>
  `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;

export const clearSessionCookie = () =>
  `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export async function createSession(userId: number) {
  const db = getDb();
  const token = randomToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_SECONDS * 1000).toISOString();
  await db.insert(sessions).values({
    userId,
    tokenHash: await sha256(token),
    expiresAt,
    createdAt: now.toISOString(),
  });
  return token;
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const token = readCookie(request);
  if (!token) return null;
  const db = getDb();
  const rows = await db.select({
    id: users.id,
    organizationId: users.organizationId,
    organizationName: organizations.name,
    name: users.name,
    email: users.email,
    role: users.role,
    platformAdmin: users.isPlatformAdmin,
  }).from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(organizations, eq(users.organizationId, organizations.id))
    .where(and(
    eq(sessions.tokenHash, await sha256(token)),
    gt(sessions.expiresAt, new Date().toISOString()),
    eq(users.status, 'active'),
    eq(organizations.status, 'active'),
  )).limit(1);
  const user = rows[0];
  if (!user) return null;
  return { ...user, role: user.role === 'master' ? 'master' : 'member' };
}

export async function requireUser(request: Request) {
  const user = await getSessionUser(request);
  if (!user) throw new AuthError(401, 'Sua sessão expirou. Entre novamente.');
  return user;
}

export async function requireMaster(request: Request) {
  const user = await requireUser(request);
  if (user.role !== 'master') throw new AuthError(403, 'Somente um Master pode realizar esta ação.');
  return user;
}

export async function requirePlatformAdmin(request: Request) {
  const user = await requireUser(request);
  if (!user.platformAdmin) throw new AuthError(403, 'Somente o administrador da plataforma pode realizar esta ação.');
  return user;
}

export async function revokeCurrentSession(request: Request) {
  const token = readCookie(request);
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, await sha256(token)));
}

export async function writeAudit(
  user: SessionUser,
  action: string,
  entityType: string,
  entityId?: string | number | null,
  details = '',
) {
  await getDb().insert(auditLogs).values({
    userId: user.id,
    organizationId: user.organizationId,
    action,
    entityType,
    entityId: entityId == null ? null : String(entityId),
    details: details.slice(0, 500),
    createdAt: new Date().toISOString(),
  });
}

export function ensureSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin) {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const firstHeaderValue = (value: string | null) => value?.split(',')[0]?.trim().toLowerCase() ?? '';
    const allowedHosts = new Set([
      requestUrl.host.toLowerCase(),
      firstHeaderValue(request.headers.get('host')),
      firstHeaderValue(request.headers.get('x-forwarded-host')),
    ].filter(Boolean));
    const secureOrigin = originUrl.protocol === 'https:'
      || (process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(originUrl.hostname));

    if (!secureOrigin || !allowedHosts.has(originUrl.host.toLowerCase())) {
      throw new AuthError(403, 'Origem da requisição inválida.');
    }
  }
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    throw new AuthError(415, 'Envie os dados no formato JSON.');
  }
}

export const authErrorResponse = (error: unknown) => {
  if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
  return null;
};

import { and, eq, lt } from 'drizzle-orm';
import { getDb } from '@/db';
import { loginAttempts, organizations, sessions, users } from '@/db/schema';
import {
  authErrorResponse, clearSessionCookie, createSession, ensureSameOrigin,
  getSessionUser, hashPassword, requireUser, revokeCurrentSession,
  sessionCookie, sha256, verifyPassword, writeAudit,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200, headers?: HeadersInit) => Response.json(data, { status, headers });

export async function GET(request: Request) {
  return json({ user: await getSessionUser(request) });
}

export async function POST(request: Request) {
  try {
    ensureSameOrigin(request);
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? 'login');
    const db = getDb();

    if (action === 'login') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      if (!email || !password) return json({ error: 'Informe seu e-mail e sua senha.' }, 400);

      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('cf-connecting-ip')
        || 'unknown';
      const attemptKey = await sha256(`${ip}|${email}`);
      const now = new Date();
      const attempts = await db.select().from(loginAttempts).where(eq(loginAttempts.key, attemptKey)).limit(1);
      if (attempts[0]?.blockedUntil && attempts[0].blockedUntil > now.toISOString()) {
        return json({ error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' }, 429);
      }

      const rows = await db.select({
        id: users.id, organizationId: users.organizationId, organizationName: organizations.name,
        name: users.name, email: users.email, passwordHash: users.passwordHash, role: users.role,
        status: users.status, platformAdmin: users.isPlatformAdmin, organizationStatus: organizations.status,
      }).from(users).innerJoin(organizations, eq(users.organizationId, organizations.id)).where(eq(users.email, email)).limit(1);
      const account = rows[0];
      const valid = account?.status === 'active' && account.organizationStatus === 'active' && await verifyPassword(password, account.passwordHash);
      if (!valid) {
        const failures = (attempts[0]?.failures ?? 0) + 1;
        const blockedUntil = failures >= 5 ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null;
        await db.insert(loginAttempts).values({ key: attemptKey, failures, blockedUntil, updatedAt: now.toISOString() })
          .onDuplicateKeyUpdate({ set: { failures, blockedUntil, updatedAt: now.toISOString() } });
        return json({ error: 'E-mail ou senha incorretos.' }, 401);
      }

      await db.delete(loginAttempts).where(eq(loginAttempts.key, attemptKey));
      await db.delete(sessions).where(and(eq(sessions.userId, account.id), lt(sessions.expiresAt, new Date().toISOString())));
      await db.update(users).set({ lastLoginAt: now.toISOString() }).where(eq(users.id, account.id));
      const token = await createSession(account.id);
      const user = {
        id: account.id, organizationId: account.organizationId, organizationName: account.organizationName,
        name: account.name, email: account.email, role: account.role === 'master' ? 'master' as const : 'member' as const,
        platformAdmin: account.platformAdmin,
      };
      await writeAudit(user, 'login', 'session');
      return json({ user }, 200, { 'set-cookie': sessionCookie(token) });
    }

    if (action === 'logout') {
      const user = await getSessionUser(request);
      if (user) await writeAudit(user, 'logout', 'session');
      await revokeCurrentSession(request);
      return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
    }

    if (action === 'changePassword') {
      const user = await requireUser(request);
      const currentPassword = String(body.currentPassword ?? '');
      const newPassword = String(body.newPassword ?? '');
      if (newPassword.length < 10) return json({ error: 'A nova senha precisa ter pelo menos 10 caracteres.' }, 400);
      const rows = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
      if (!rows[0] || !(await verifyPassword(currentPassword, rows[0].passwordHash))) {
        return json({ error: 'A senha atual está incorreta.' }, 400);
      }
      await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, user.id));
      await db.delete(sessions).where(eq(sessions.userId, user.id));
      await writeAudit(user, 'change_password', 'user', user.id);
      return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
    }

    return json({ error: 'Ação desconhecida.' }, 400);
  } catch (error) {
    return authErrorResponse(error) ?? json({ error: error instanceof Error ? error.message : 'Falha na autenticação.' }, 500);
  }
}

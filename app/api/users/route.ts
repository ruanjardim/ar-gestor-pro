import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { auditLogs, sessions, users } from '@/db/schema';
import { authErrorResponse, ensureSameOrigin, hashPassword, requireMaster, writeAudit } from '@/lib/auth';

export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status });

export async function GET(request: Request) {
  try {
    const master = await requireMaster(request);
    const db = getDb();
    const [userRows, auditRows] = await Promise.all([
      db.select({
        id: users.id, name: users.name, email: users.email, role: users.role,
        status: users.status, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt,
      }).from(users).where(eq(users.organizationId, master.organizationId)).orderBy(desc(users.createdAt)),
      db.select().from(auditLogs).where(eq(auditLogs.organizationId, master.organizationId)).orderBy(desc(auditLogs.createdAt)).limit(60),
    ]);
    const names = new Map(userRows.map((user) => [user.id, user.name]));
    return json({ users: userRows, audit: auditRows.map((row) => ({ ...row, userName: row.userId ? names.get(row.userId) ?? 'Usuário removido' : 'Sistema' })) });
  } catch (error) {
    return authErrorResponse(error) ?? json({ error: error instanceof Error ? error.message : 'Falha ao carregar a equipe.' }, 500);
  }
}

export async function POST(request: Request) {
  try {
    ensureSameOrigin(request);
    const master = await requireMaster(request);
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? '');
    const db = getDb();

    if (action === 'createUser') {
      const name = String(body.name ?? '').trim();
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      const role = body.role === 'master' ? 'master' : 'member';
      if (name.length < 2 || !email.includes('@') || password.length < 10) {
        return json({ error: 'Informe nome, e-mail válido e uma senha de pelo menos 10 caracteres.' }, 400);
      }
      const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing.length) return json({ error: 'Já existe uma conta com este e-mail.' }, 409);
      const [created] = await db.insert(users).values({
        organizationId: master.organizationId, isPlatformAdmin: false,
        name, email, passwordHash: await hashPassword(password), role, status: 'active',
        createdAt: new Date().toISOString(), createdBy: master.id,
      }).returning({ id: users.id });
      await writeAudit(master, 'create_user', 'user', created.id, `${name} (${role})`);
    } else if (action === 'setStatus') {
      const id = Number(body.id);
      const status = body.status === 'blocked' ? 'blocked' : 'active';
      if (!Number.isInteger(id)) return json({ error: 'Usuário inválido.' }, 400);
      if (id === master.id && status === 'blocked') return json({ error: 'Você não pode bloquear sua própria conta.' }, 400);
      const [target] = await db.update(users).set({ status }).where(and(eq(users.id, id), eq(users.organizationId, master.organizationId))).returning({ id: users.id });
      if (!target) return json({ error: 'Usuário não encontrado nesta empresa.' }, 404);
      if (status === 'blocked') await db.delete(sessions).where(eq(sessions.userId, target.id));
      await writeAudit(master, 'set_user_status', 'user', id, status);
    } else if (action === 'setRole') {
      const id = Number(body.id);
      const role = body.role === 'master' ? 'master' : 'member';
      if (!Number.isInteger(id)) return json({ error: 'Usuário inválido.' }, 400);
      if (id === master.id && role !== 'master') return json({ error: 'Você não pode retirar seu próprio acesso Master.' }, 400);
      const [target] = await db.update(users).set({ role }).where(and(eq(users.id, id), eq(users.organizationId, master.organizationId))).returning({ id: users.id });
      if (!target) return json({ error: 'Usuário não encontrado nesta empresa.' }, 404);
      await db.delete(sessions).where(eq(sessions.userId, target.id));
      await writeAudit(master, 'set_user_role', 'user', id, role);
    } else if (action === 'resetPassword') {
      const id = Number(body.id);
      const password = String(body.password ?? '');
      if (!Number.isInteger(id) || password.length < 10) return json({ error: 'Use uma senha de pelo menos 10 caracteres.' }, 400);
      const [target] = await db.update(users).set({ passwordHash: await hashPassword(password) }).where(and(eq(users.id, id), eq(users.organizationId, master.organizationId))).returning({ id: users.id });
      if (!target) return json({ error: 'Usuário não encontrado nesta empresa.' }, 404);
      await db.delete(sessions).where(eq(sessions.userId, target.id));
      await writeAudit(master, 'reset_user_password', 'user', id);
    } else {
      return json({ error: 'Ação desconhecida.' }, 400);
    }

    return json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? json({ error: error instanceof Error ? error.message : 'Falha ao atualizar a equipe.' }, 500);
  }
}

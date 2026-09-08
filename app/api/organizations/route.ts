import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { clients, organizations, sessions, users } from '@/db/schema';
import { authErrorResponse, ensureSameOrigin, hashPassword, requirePlatformAdmin, writeAudit } from '@/lib/auth';

export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status });

const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'empresa';

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin(request);
    const db = getDb();
    const [orgRows, userRows, clientRows] = await Promise.all([
      db.select().from(organizations).orderBy(desc(organizations.createdAt)),
      db.select({ id: users.id, organizationId: users.organizationId }).from(users),
      db.select({ id: clients.id, organizationId: clients.organizationId }).from(clients),
    ]);
    return json({ organizations: orgRows.map((organization) => ({
      ...organization,
      users: userRows.filter((user) => user.organizationId === organization.id).length,
      clients: clientRows.filter((client) => client.organizationId === organization.id).length,
    })) });
  } catch (error) {
    return authErrorResponse(error) ?? json({ error: error instanceof Error ? error.message : 'Falha ao carregar as empresas.' }, 500);
  }
}

export async function POST(request: Request) {
  try {
    ensureSameOrigin(request);
    const admin = await requirePlatformAdmin(request);
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? '');
    const db = getDb();

    if (action === 'createOrganization') {
      const name = String(body.name ?? '').trim();
      const masterName = String(body.masterName ?? '').trim();
      const masterEmail = String(body.masterEmail ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      if (name.length < 2 || masterName.length < 2 || !masterEmail.includes('@') || password.length < 10) {
        return json({ error: 'Informe empresa, responsável, e-mail válido e senha de pelo menos 10 caracteres.' }, 400);
      }
      const existingUser = await db.select({ id: users.id }).from(users).where(eq(users.email, masterEmail)).limit(1);
      if (existingUser.length) return json({ error: 'Já existe uma conta com este e-mail.' }, 409);
      const rootSlug = slugify(name);
      let slug = rootSlug;
      for (let suffix = 2; suffix < 100; suffix += 1) {
        const existing = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, slug)).limit(1);
        if (!existing.length) break;
        slug = `${rootSlug}-${suffix}`;
      }
      const now = new Date().toISOString();
      const [organization] = await db.insert(organizations).values({ name, slug, status: 'active', plan: 'standard', createdAt: now }).returning({ id: organizations.id });
      try {
        await db.insert(users).values({
          organizationId: organization.id, isPlatformAdmin: false, name: masterName, email: masterEmail,
          passwordHash: await hashPassword(password), role: 'master', status: 'active', createdAt: now, createdBy: admin.id,
        });
      } catch (error) {
        await db.delete(organizations).where(eq(organizations.id, organization.id));
        throw error;
      }
      await writeAudit(admin, 'create_organization', 'organization', organization.id, name);
    } else if (action === 'setOrganizationStatus') {
      const id = Number(body.id);
      const status = body.status === 'blocked' ? 'blocked' : 'active';
      if (!Number.isInteger(id)) return json({ error: 'Empresa inválida.' }, 400);
      if (id === admin.organizationId && status === 'blocked') return json({ error: 'A empresa principal não pode ser bloqueada por aqui.' }, 400);
      const [updated] = await db.update(organizations).set({ status }).where(eq(organizations.id, id)).returning({ id: organizations.id });
      if (!updated) return json({ error: 'Empresa não encontrada.' }, 404);
      if (status === 'blocked') {
        const orgUsers = await db.select({ id: users.id }).from(users).where(eq(users.organizationId, id));
        for (const user of orgUsers) await db.delete(sessions).where(eq(sessions.userId, user.id));
      }
      await writeAudit(admin, 'set_organization_status', 'organization', id, status);
    } else if (action === 'setOrganizationPlan') {
      const id = Number(body.id);
      const plan = ['standard', 'pro', 'internal'].includes(String(body.plan)) ? String(body.plan) : 'standard';
      if (!Number.isInteger(id)) return json({ error: 'Empresa inválida.' }, 400);
      const [updated] = await db.update(organizations).set({ plan }).where(eq(organizations.id, id)).returning({ id: organizations.id });
      if (!updated) return json({ error: 'Empresa não encontrada.' }, 404);
      await writeAudit(admin, 'set_organization_plan', 'organization', id, plan);
    } else {
      return json({ error: 'Ação desconhecida.' }, 400);
    }
    return json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? json({ error: error instanceof Error ? error.message : 'Falha ao atualizar a empresa.' }, 500);
  }
}

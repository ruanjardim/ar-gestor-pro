import { and, asc, eq, like } from 'drizzle-orm';
import { getDb } from '@/db';
import { categories, clients, financialTransactions, notes, settings } from '@/db/schema';
import { authErrorResponse, ensureSameOrigin, requireUser, writeAudit } from '@/lib/auth';
import { isBillingReliefActive, overdueDays, PAYMENT_GRACE_DAYS, type ClientBlockStatus } from '@/lib/client-status';

export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status });
const saoPauloDateKey = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const db = getDb();
    const [clientRows, categoryRows, noteRows, settingRows] = await Promise.all([
      db.select({
        id: clients.id, name: clients.name, phone: clients.phone,
        telegramChatId: clients.telegramChatId, categoryId: clients.categoryId,
        categoryName: categories.name, observation: clients.observation,
        dueDate: clients.dueDate, amount: clients.amount, blockStatus: clients.blockStatus,
        blockedAt: clients.blockedAt, lastPaidAt: clients.lastPaidAt,
        billingStatus: clients.billingStatus, billingReason: clients.billingReason,
        billingStartedAt: clients.billingStartedAt, billingEndsAt: clients.billingEndsAt,
      }).from(clients).leftJoin(categories, and(eq(clients.categoryId, categories.id), eq(categories.organizationId, user.organizationId))).where(eq(clients.organizationId, user.organizationId)).orderBy(asc(clients.name)),
      db.select().from(categories).where(eq(categories.organizationId, user.organizationId)).orderBy(asc(categories.name)),
      db.select().from(notes).where(eq(notes.organizationId, user.organizationId)).orderBy(asc(notes.id)),
      db.select().from(settings).where(like(settings.key, `${user.organizationId}:%`)),
    ]);
    return json({
      clients: clientRows,
      categories: categoryRows,
      notes: noteRows,
      settings: Object.fromEntries(settingRows.map((row) => [row.key.slice(row.key.indexOf(':') + 1), row.value])),
    });
  } catch (error) {
    return authErrorResponse(error) ?? json({ error: error instanceof Error ? error.message : 'Falha ao carregar os dados.' }, 500);
  }
}

export async function POST(request: Request) {
  try {
    ensureSameOrigin(request);
    const user = await requireUser(request);
    const body = await request.json() as Record<string, unknown>;
    const db = getDb();
    const action = String(body.action ?? '');

    if (action === 'createClient') {
      const name = String(body.name ?? '').trim();
      const phone = String(body.phone ?? '').trim();
      const dueDate = String(body.dueDate ?? '').trim();
      const amount = Number(body.amount ?? 0);
      const categoryId = body.categoryId ? Number(body.categoryId) : null;
      if (!name || !phone || !dueDate || !Number.isFinite(amount) || amount < 0) {
        return json({ error: 'Preencha nome, telefone, vencimento e valor corretamente.' }, 400);
      }
      if (categoryId) {
        const category = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, categoryId), eq(categories.organizationId, user.organizationId))).limit(1);
        if (!category.length) return json({ error: 'Categoria inválida para esta empresa.' }, 400);
      }
      const [created] = await db.insert(clients).values({
        organizationId: user.organizationId, name, phone, dueDate, amount,
        telegramChatId: String(body.telegramChatId ?? '').trim() || null,
        categoryId,
        observation: String(body.observation ?? '').trim(),
        createdAt: new Date().toISOString(),
      }).$returningId();
      await writeAudit(user, 'create_client', 'client', created.id, name);
    } else if (action === 'updateClient') {
      const id = Number(body.id);
      const name = String(body.name ?? '').trim();
      const phone = String(body.phone ?? '').trim();
      const dueDate = String(body.dueDate ?? '').trim();
      const amount = Number(body.amount ?? 0);
      const categoryId = body.categoryId ? Number(body.categoryId) : null;
      if (!Number.isInteger(id) || !name || !phone || !dueDate || !Number.isFinite(amount) || amount < 0) {
        return json({ error: 'Preencha nome, telefone, vencimento e valor corretamente.' }, 400);
      }
      if (categoryId) {
        const category = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, categoryId), eq(categories.organizationId, user.organizationId))).limit(1);
        if (!category.length) return json({ error: 'Categoria inválida para esta empresa.' }, 400);
      }
      const [existing] = await db.select({ id: clients.id }).from(clients)
        .where(and(eq(clients.id, id), eq(clients.organizationId, user.organizationId))).limit(1);
      if (!existing) return json({ error: 'Cliente não encontrado.' }, 404);
      await db.update(clients).set({
        name, phone, dueDate, amount,
        telegramChatId: String(body.telegramChatId ?? '').trim() || null,
        categoryId,
        observation: String(body.observation ?? '').trim(),
      }).where(and(eq(clients.id, id), eq(clients.organizationId, user.organizationId)));
      await writeAudit(user, 'update_client', 'client', id, name);
    } else if (action === 'deleteClient') {
      const id = Number(body.id);
      await db.delete(clients).where(and(eq(clients.id, id), eq(clients.organizationId, user.organizationId)));
      await writeAudit(user, 'delete_client', 'client', id);
    } else if (action === 'renewClient') {
      const id = Number(body.id);
      if (!Number.isInteger(id)) return json({ error: 'Cliente inválido.' }, 400);
      const [existing] = await db.select({ id: clients.id, name: clients.name, amount: clients.amount, dueDate: clients.dueDate }).from(clients)
        .where(and(eq(clients.id, id), eq(clients.organizationId, user.organizationId))).limit(1);
      if (!existing) return json({ error: 'Cliente não encontrado.' }, 404);
      const date = new Date(existing.dueDate + 'T12:00:00');
      if (Number.isNaN(date.getTime())) return json({ error: 'Vencimento do cliente inválido.' }, 400);
      date.setMonth(date.getMonth() + 1);
      const paidAt = new Date().toISOString();
      await db.transaction(async (tx) => {
        await tx.update(clients).set({
          dueDate: date.toISOString().slice(0, 10),
          blockStatus: 'active',
          blockedAt: null,
          lastPaidAt: paidAt,
          billingStatus: 'normal',
          billingReason: '',
          billingStartedAt: null,
          billingEndsAt: null,
        })
          .where(and(eq(clients.id, id), eq(clients.organizationId, user.organizationId)));
        await tx.insert(financialTransactions).values({
          organizationId: user.organizationId,
          clientId: existing.id,
          createdBy: user.id,
          type: 'income',
          category: 'Mensalidade de cliente',
          description: `Recebimento de ${existing.name}`,
          amount: existing.amount,
          transactionDate: new Date().toISOString().slice(0, 10),
          source: 'client_payment',
          createdAt: new Date().toISOString(),
        });
      });
      await writeAudit(user, 'renew_client', 'client', id, date.toISOString().slice(0, 10));
    } else if (action === 'setClientBlock') {
      const id = Number(body.id);
      const blockStatus = (typeof body.blockStatus === 'string' ? body.blockStatus : '') as ClientBlockStatus;
      const allowedStatuses: ClientBlockStatus[] = ['active', 'temporary_blocked', 'permanently_blocked'];
      if (!Number.isInteger(id) || !allowedStatuses.includes(blockStatus)) {
        return json({ error: 'Cliente ou tipo de bloqueio inválido.' }, 400);
      }
      const [existing] = await db.select({
        id: clients.id, name: clients.name, dueDate: clients.dueDate,
        billingStatus: clients.billingStatus, billingEndsAt: clients.billingEndsAt,
      }).from(clients)
        .where(and(eq(clients.id, id), eq(clients.organizationId, user.organizationId))).limit(1);
      if (!existing) return json({ error: 'Cliente não encontrado.' }, 404);
      if (blockStatus !== 'active' && isBillingReliefActive(existing)) {
        return json({ error: 'Clientes com cortesia ou isenção ativa não podem ser bloqueados.' }, 400);
      }
      if (blockStatus === 'permanently_blocked' && overdueDays(existing.dueDate) <= PAYMENT_GRACE_DAYS) {
        return json({ error: `O bloqueio definitivo só fica disponível após os ${PAYMENT_GRACE_DAYS} dias de carência.` }, 400);
      }
      await db.update(clients).set({
        blockStatus,
        blockedAt: blockStatus === 'active' ? null : new Date().toISOString(),
      }).where(and(eq(clients.id, id), eq(clients.organizationId, user.organizationId)));
      const label = blockStatus === 'active' ? 'desbloqueado' : blockStatus === 'temporary_blocked' ? 'bloqueio temporário' : 'bloqueio definitivo';
      await writeAudit(user, 'set_client_block', 'client', id, `${existing.name}: ${label}`);
    } else if (action === 'setClientBillingRelief') {
      const id = Number(body.id);
      const mode = typeof body.mode === 'string' ? body.mode : '';
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
      const endsAt = typeof body.endsAt === 'string' ? body.endsAt.trim() : '';
      const allowedModes = ['normal', 'courtesy', 'exempt_until', 'exempt_indefinite'];
      if (!Number.isInteger(id) || !allowedModes.includes(mode)) {
        return json({ error: 'Cliente ou tipo de cortesia/isenção inválido.' }, 400);
      }
      const [existing] = await db.select({ id: clients.id, name: clients.name, dueDate: clients.dueDate }).from(clients)
        .where(and(eq(clients.id, id), eq(clients.organizationId, user.organizationId))).limit(1);
      if (!existing) return json({ error: 'Cliente não encontrado.' }, 404);

      if (mode === 'normal') {
        const resumedDueDate = existing.dueDate < saoPauloDateKey() ? saoPauloDateKey() : existing.dueDate;
        await db.update(clients).set({
          dueDate: resumedDueDate,
          billingStatus: 'normal', billingReason: '', billingStartedAt: null, billingEndsAt: null,
          blockStatus: 'active', blockedAt: null,
        }).where(and(eq(clients.id, id), eq(clients.organizationId, user.organizationId)));
        await writeAudit(user, 'set_client_billing_relief', 'client', id, `${existing.name}: cobrança normal em ${resumedDueDate}`);
      } else {
        if (!reason || reason.length > 500) return json({ error: 'Informe o motivo da cortesia ou isenção (até 500 caracteres).' }, 400);
        const startedAt = new Date().toISOString();
        const billingStatus: 'courtesy' | 'exempt' = mode === 'courtesy' ? 'courtesy' : 'exempt';
        let billingEndsAt: string | null = null;
        let dueDate = existing.dueDate;

        if (mode === 'courtesy') {
          const nextDueDate = new Date(`${existing.dueDate}T12:00:00`);
          if (Number.isNaN(nextDueDate.getTime())) return json({ error: 'Vencimento do cliente inválido.' }, 400);
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
          dueDate = nextDueDate.toISOString().slice(0, 10);
          billingEndsAt = dueDate;
        } else if (mode === 'exempt_until') {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(endsAt) || Number.isNaN(new Date(`${endsAt}T12:00:00`).getTime()) || endsAt < saoPauloDateKey()) {
            return json({ error: 'Informe uma data final válida, igual ou posterior a hoje.' }, 400);
          }
          billingEndsAt = endsAt;
          dueDate = endsAt;
        }

        await db.update(clients).set({
          dueDate, billingStatus, billingReason: reason, billingStartedAt: startedAt, billingEndsAt,
          blockStatus: 'active', blockedAt: null,
        }).where(and(eq(clients.id, id), eq(clients.organizationId, user.organizationId)));
        const period = mode === 'courtesy' ? `cortesia até ${billingEndsAt}` : mode === 'exempt_until' ? `isenção até ${billingEndsAt}` : 'isenção sem prazo';
        await writeAudit(user, 'set_client_billing_relief', 'client', id, `${existing.name}: ${period} · ${reason}`);
      }
    } else if (action === 'createCategory') {
      const name = String(body.name ?? '').trim();
      if (!name) return json({ error: 'Informe o nome da categoria.' }, 400);
      await db.insert(categories).ignore().values({ organizationId: user.organizationId, name });
      await writeAudit(user, 'create_category', 'category', null, name);
    } else if (action === 'deleteCategory') {
      const id = Number(body.id);
      await db.transaction(async (tx) => {
        await tx.update(clients).set({ categoryId: null }).where(and(eq(clients.categoryId, id), eq(clients.organizationId, user.organizationId)));
        await tx.delete(categories).where(and(eq(categories.id, id), eq(categories.organizationId, user.organizationId)));
      });
      await writeAudit(user, 'delete_category', 'category', id);
    } else if (action === 'createNote') {
      const title = String(body.title ?? '').trim();
      const content = String(body.content ?? '').trim();
      if (!title || !content) return json({ error: 'Informe título e conteúdo da nota.' }, 400);
      const [created] = await db.insert(notes).values({ organizationId: user.organizationId, title, content, createdAt: new Date().toISOString() }).$returningId();
      await writeAudit(user, 'create_note', 'note', created.id, title);
    } else if (action === 'deleteNote') {
      const id = Number(body.id);
      await db.delete(notes).where(and(eq(notes.id, id), eq(notes.organizationId, user.organizationId)));
      await writeAudit(user, 'delete_note', 'note', id);
    } else if (action === 'saveSettings') {
      if (!body.values || typeof body.values !== 'object' || Array.isArray(body.values)) {
        return json({ error: 'Configuração inválida.' }, 400);
      }
      const entries = Object.entries(body.values as Record<string, unknown>).slice(0, 40);
      for (const [key, value] of entries) {
        if (!/^[a-zA-Z][a-zA-Z0-9]{0,49}$/.test(key)) continue;
        const scopedKey = `${user.organizationId}:${key}`;
        await db.insert(settings).values({ key: scopedKey, value: String(value).slice(0, 5000) })
          .onDuplicateKeyUpdate({ set: { value: String(value).slice(0, 5000) } });
      }
      await writeAudit(user, 'save_settings', 'settings', null, entries.map(([key]) => key).join(', '));
    } else {
      return json({ error: 'Ação desconhecida.' }, 400);
    }
    return json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? json({ error: error instanceof Error ? error.message : 'Falha ao salvar.' }, 500);
  }
}

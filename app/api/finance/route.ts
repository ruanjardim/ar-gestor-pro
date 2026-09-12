import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { getDb } from '@/db';
import { clients, financialTransactions, users } from '@/db/schema';
import { authErrorResponse, ensureSameOrigin, requireFinanceAccess, writeAudit } from '@/lib/auth';

export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status });
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const textValue = (value: unknown) => typeof value === 'string' ? value : '';

function monthBounds(value: string | null) {
  const month = value && monthPattern.test(value) ? value : new Date().toISOString().slice(0, 7);
  const [year, monthNumber] = month.split('-').map(Number);
  const next = monthNumber === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;
  return { month, start: `${month}-01`, next };
}

async function ownedClient(organizationId: number, clientId: number | null) {
  if (!clientId) return null;
  const [client] = await getDb().select({ id: clients.id, name: clients.name, amount: clients.amount })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, organizationId)))
    .limit(1);
  return client ?? null;
}

export async function GET(request: Request) {
  try {
    const user = await requireFinanceAccess(request);
    const { month, start, next } = monthBounds(new URL(request.url).searchParams.get('month'));
    const db = getDb();
    const [transactions, clientRows] = await Promise.all([
      db.select({
        id: financialTransactions.id,
        clientId: financialTransactions.clientId,
        clientName: clients.name,
        createdByName: users.name,
        type: financialTransactions.type,
        category: financialTransactions.category,
        description: financialTransactions.description,
        amount: financialTransactions.amount,
        transactionDate: financialTransactions.transactionDate,
        source: financialTransactions.source,
        createdAt: financialTransactions.createdAt,
      }).from(financialTransactions)
        .leftJoin(clients, and(
          eq(financialTransactions.clientId, clients.id),
          eq(clients.organizationId, user.organizationId),
        ))
        .leftJoin(users, eq(financialTransactions.createdBy, users.id))
        .where(and(
          eq(financialTransactions.organizationId, user.organizationId),
          gte(financialTransactions.transactionDate, start),
          lt(financialTransactions.transactionDate, next),
        ))
        .orderBy(desc(financialTransactions.transactionDate), desc(financialTransactions.id)),
      db.select({ id: clients.id, name: clients.name, amount: clients.amount, dueDate: clients.dueDate })
        .from(clients)
        .where(eq(clients.organizationId, user.organizationId))
        .orderBy(clients.name),
    ]);

    return json({ month, transactions, clients: clientRows });
  } catch (error) {
    return authErrorResponse(error) ?? json({ error: error instanceof Error ? error.message : 'Falha ao carregar o financeiro.' }, 500);
  }
}

export async function POST(request: Request) {
  try {
    ensureSameOrigin(request);
    const user = await requireFinanceAccess(request);
    const body = await request.json() as Record<string, unknown>;
    const action = textValue(body.action);
    const db = getDb();

    if (action === 'createTransaction' || action === 'updateTransaction') {
      const id = Number(body.id);
      const type = textValue(body.type);
      const category = textValue(body.category).trim().slice(0, 100);
      const description = textValue(body.description).trim().slice(0, 300);
      const amount = Number(body.amount);
      const transactionDate = textValue(body.transactionDate);
      const clientId = body.clientId ? Number(body.clientId) : null;
      if (!['income', 'expense', 'investment'].includes(type) || !category || !description
        || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
        return json({ error: 'Preencha tipo, categoria, descrição, valor e data corretamente.' }, 400);
      }
      if (clientId && !await ownedClient(user.organizationId, clientId)) {
        return json({ error: 'Cliente inválido para esta empresa.' }, 400);
      }
      if (type !== 'income' && clientId) return json({ error: 'Somente receitas podem ser vinculadas a clientes.' }, 400);

      const values = { clientId, type, category, description, amount, transactionDate };
      if (action === 'createTransaction') {
        const [created] = await db.insert(financialTransactions).values({
          organizationId: user.organizationId,
          createdBy: user.id,
          ...values,
          source: 'manual',
          createdAt: new Date().toISOString(),
        }).$returningId();
        await writeAudit(user, 'create_financial_transaction', 'financial_transaction', created.id, `${type}: ${description}`);
      } else {
        if (!Number.isInteger(id)) return json({ error: 'Lançamento inválido.' }, 400);
        const [existing] = await db.select({ id: financialTransactions.id }).from(financialTransactions)
          .where(and(eq(financialTransactions.id, id), eq(financialTransactions.organizationId, user.organizationId))).limit(1);
        if (!existing) return json({ error: 'Lançamento não encontrado.' }, 404);
        await db.update(financialTransactions).set(values)
          .where(and(eq(financialTransactions.id, id), eq(financialTransactions.organizationId, user.organizationId)));
        await writeAudit(user, 'update_financial_transaction', 'financial_transaction', id, `${type}: ${description}`);
      }
    } else if (action === 'deleteTransaction') {
      const id = Number(body.id);
      if (!Number.isInteger(id)) return json({ error: 'Lançamento inválido.' }, 400);
      const [existing] = await db.select({ id: financialTransactions.id, source: financialTransactions.source })
        .from(financialTransactions)
        .where(and(eq(financialTransactions.id, id), eq(financialTransactions.organizationId, user.organizationId))).limit(1);
      if (!existing) return json({ error: 'Lançamento não encontrado.' }, 404);
      await db.delete(financialTransactions)
        .where(and(eq(financialTransactions.id, id), eq(financialTransactions.organizationId, user.organizationId)));
      await writeAudit(user, 'delete_financial_transaction', 'financial_transaction', id, existing.source);
    } else {
      return json({ error: 'Ação desconhecida.' }, 400);
    }

    return json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? json({ error: error instanceof Error ? error.message : 'Falha ao salvar o lançamento.' }, 500);
  }
}

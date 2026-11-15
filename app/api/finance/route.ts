import { and, desc, eq } from 'drizzle-orm';
import { ensureFinancialPlanningSchema, getDb } from '@/db';
import { clients, financialTransactions, users } from '@/db/schema';
import { authErrorResponse, ensureSameOrigin, requireFinanceAccess, writeAudit } from '@/lib/auth';
import { addDaysToDateKey, addMonthsToDateKey, saoPauloDateKey } from '@/lib/business-date';
import { isBillingReliefActive } from '@/lib/client-status';

export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status });
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const yearPattern = /^\d{4}$/;
const textValue = (value: unknown) => typeof value === 'string' ? value : '';

type FinanceScope = 'day' | 'month' | 'year';
type TransactionStatus = 'realized' | 'planned';
type TransactionType = 'income' | 'expense' | 'investment';

function periodBounds(searchParams: URLSearchParams) {
  const requestedScope = searchParams.get('scope');
  const scope: FinanceScope = requestedScope === 'day' || requestedScope === 'year' ? requestedScope : 'month';
  const today = saoPauloDateKey();
  const requestedPeriod = searchParams.get('period') ?? searchParams.get('month');
  if (scope === 'day') {
    const period = requestedPeriod && datePattern.test(requestedPeriod) ? requestedPeriod : today;
    return { scope, period, start: period, next: addDaysToDateKey(period, 1) };
  }
  if (scope === 'year') {
    const period = requestedPeriod && yearPattern.test(requestedPeriod) ? requestedPeriod : today.slice(0, 4);
    return { scope, period, start: `${period}-01-01`, next: `${Number(period) + 1}-01-01` };
  }
  const period = requestedPeriod && monthPattern.test(requestedPeriod) ? requestedPeriod : today.slice(0, 7);
  return { scope, period, start: `${period}-01`, next: addMonthsToDateKey(`${period}-01`, 1) };
}

function isInPeriod(value: string | null, start: string, next: string) {
  return Boolean(value && value >= start && value < next);
}

function sumByType(rows: Array<{ type: string; amount: number }>) {
  return rows.reduce((totals, row) => {
    if (row.type === 'income' || row.type === 'expense' || row.type === 'investment') totals[row.type] += row.amount;
    return totals;
  }, { income: 0, expense: 0, investment: 0 });
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
    if (!await ensureFinancialPlanningSchema()) return json({ error: 'Não foi possível preparar o planejamento financeiro.' }, 503);
    const bounds = periodBounds(new URL(request.url).searchParams);
    const today = saoPauloDateKey();
    const db = getDb();
    const [transactionRows, clientRows] = await Promise.all([
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
        status: financialTransactions.status,
        settledDate: financialTransactions.settledDate,
        source: financialTransactions.source,
        createdAt: financialTransactions.createdAt,
      }).from(financialTransactions)
        .leftJoin(clients, and(eq(financialTransactions.clientId, clients.id), eq(clients.organizationId, user.organizationId)))
        .leftJoin(users, eq(financialTransactions.createdBy, users.id))
        .where(eq(financialTransactions.organizationId, user.organizationId))
        .orderBy(desc(financialTransactions.transactionDate), desc(financialTransactions.id)),
      db.select({
        id: clients.id,
        name: clients.name,
        amount: clients.amount,
        dueDate: clients.dueDate,
        billingStatus: clients.billingStatus,
        billingEndsAt: clients.billingEndsAt,
      }).from(clients).where(eq(clients.organizationId, user.organizationId)).orderBy(clients.name),
    ]);

    const transactions = transactionRows.filter((row) => {
      const effectiveDate = row.status === 'planned' ? row.transactionDate : (row.settledDate || row.transactionDate);
      return isInPeriod(effectiveDate, bounds.start, bounds.next);
    });
    const realizedAll = transactionRows.filter((row) => row.status !== 'planned');
    const realizedPeriod = transactions.filter((row) => row.status !== 'planned');
    const plannedPeriod = transactions.filter((row) => row.status === 'planned');
    const ledgerTotals = sumByType(realizedAll);
    const realizedTotals = sumByType(realizedPeriod);
    const plannedTotals = sumByType(plannedPeriod);
    const plannedClientDueKeys = new Set(transactionRows
      .filter((row) => row.status === 'planned' && row.type === 'income' && row.clientId)
      .map((row) => `${row.clientId}:${row.transactionDate}`));
    const clientReceivables = clientRows
      .filter((client) => client.amount > 0
        && !isBillingReliefActive(client)
        && !plannedClientDueKeys.has(`${client.id}:${client.dueDate}`))
      .map((client) => ({
        id: `client-${client.id}-${client.dueDate}`,
        source: 'client_due',
        clientId: client.id,
        clientName: client.name,
        description: `Mensalidade de ${client.name}`,
        dueDate: client.dueDate,
        amount: client.amount,
        overdue: client.dueDate < today,
      }));
    const plannedReceivables = transactionRows
      .filter((row) => row.status === 'planned' && row.type === 'income')
      .map((row) => ({
        id: `transaction-${row.id}`,
        transactionId: row.id,
        source: 'planned_transaction',
        clientId: row.clientId,
        clientName: row.clientName,
        description: row.description,
        dueDate: row.transactionDate,
        amount: row.amount,
        overdue: row.transactionDate < today,
      }));
    const payables = transactionRows
      .filter((row) => row.status === 'planned' && (row.type === 'expense' || row.type === 'investment'))
      .map((row) => ({
        id: `transaction-${row.id}`,
        transactionId: row.id,
        source: 'planned_transaction',
        type: row.type,
        description: row.description,
        dueDate: row.transactionDate,
        amount: row.amount,
        overdue: row.transactionDate < today,
      }));
    const receivables = [...clientReceivables, ...plannedReceivables];
    const inScopeOrOverdue = <T extends { dueDate: string; overdue: boolean }>(row: T) => row.overdue || isInPeriod(row.dueDate, bounds.start, bounds.next);
    const scopedReceivables = receivables.filter(inScopeOrOverdue);
    const scopedPayables = payables.filter(inScopeOrOverdue);
    const currentBalance = ledgerTotals.income - ledgerTotals.expense - ledgerTotals.investment;
    const receivable = receivables.reduce((total, row) => total + row.amount, 0);
    const payable = payables.reduce((total, row) => total + row.amount, 0);

    return json({
      ...bounds,
      transactions,
      clients: clientRows.map(({ billingStatus: _billingStatus, billingEndsAt: _billingEndsAt, ...client }) => client),
      accounts: { receivable: scopedReceivables, payable: scopedPayables },
      summary: {
        ledger: ledgerTotals,
        realized: realizedTotals,
        planned: plannedTotals,
        currentBalance,
        receivable,
        payable,
        projectedBalance: currentBalance + receivable - payable,
        overdueReceivable: receivables.filter((row) => row.overdue).reduce((total, row) => total + row.amount, 0),
        overduePayable: payables.filter((row) => row.overdue).reduce((total, row) => total + row.amount, 0),
      },
    });
  } catch (error) {
    return authErrorResponse(error) ?? json({ error: error instanceof Error ? error.message : 'Falha ao carregar o financeiro.' }, 500);
  }
}

export async function POST(request: Request) {
  try {
    ensureSameOrigin(request);
    const user = await requireFinanceAccess(request);
    if (!await ensureFinancialPlanningSchema()) return json({ error: 'Não foi possível preparar o planejamento financeiro.' }, 503);
    const body = await request.json() as Record<string, unknown>;
    const action = textValue(body.action);
    const db = getDb();

    if (action === 'createTransaction' || action === 'updateTransaction') {
      const id = Number(body.id);
      const type = textValue(body.type) as TransactionType;
      const status = (textValue(body.status) || 'realized') as TransactionStatus;
      const category = textValue(body.category).trim().slice(0, 100);
      const description = textValue(body.description).trim().slice(0, 300);
      const amount = Number(body.amount);
      const transactionDate = textValue(body.transactionDate);
      const clientId = body.clientId ? Number(body.clientId) : null;
      if (!['income', 'expense', 'investment'].includes(type) || !['realized', 'planned'].includes(status)
        || !category || !description || !Number.isFinite(amount) || amount <= 0 || !datePattern.test(transactionDate)) {
        return json({ error: 'Preencha tipo, situação, categoria, descrição, valor e data corretamente.' }, 400);
      }
      if (clientId && !await ownedClient(user.organizationId, clientId)) return json({ error: 'Cliente inválido para esta empresa.' }, 400);
      if (type !== 'income' && clientId) return json({ error: 'Somente receitas podem ser vinculadas a clientes.' }, 400);
      const values = {
        clientId, type, category, description, amount, transactionDate, status,
        settledDate: status === 'realized' ? transactionDate : null,
      };
      if (action === 'createTransaction') {
        const [created] = await db.insert(financialTransactions).values({
          organizationId: user.organizationId,
          createdBy: user.id,
          ...values,
          source: 'manual',
          createdAt: new Date().toISOString(),
        }).$returningId();
        await writeAudit(user, 'create_financial_transaction', 'financial_transaction', created.id, `${status}: ${type}: ${description}`);
      } else {
        if (!Number.isInteger(id)) return json({ error: 'Lançamento inválido.' }, 400);
        const [existing] = await db.select({ id: financialTransactions.id }).from(financialTransactions)
          .where(and(eq(financialTransactions.id, id), eq(financialTransactions.organizationId, user.organizationId))).limit(1);
        if (!existing) return json({ error: 'Lançamento não encontrado.' }, 404);
        await db.update(financialTransactions).set(values)
          .where(and(eq(financialTransactions.id, id), eq(financialTransactions.organizationId, user.organizationId)));
        await writeAudit(user, 'update_financial_transaction', 'financial_transaction', id, `${status}: ${type}: ${description}`);
      }
    } else if (action === 'settleTransaction') {
      const id = Number(body.id);
      const settledDate = textValue(body.settledDate) || saoPauloDateKey();
      if (!Number.isInteger(id) || !datePattern.test(settledDate)) return json({ error: 'Lançamento ou data de baixa inválidos.' }, 400);
      const [existing] = await db.select({ id: financialTransactions.id, status: financialTransactions.status, description: financialTransactions.description })
        .from(financialTransactions)
        .where(and(eq(financialTransactions.id, id), eq(financialTransactions.organizationId, user.organizationId))).limit(1);
      if (!existing) return json({ error: 'Lançamento não encontrado.' }, 404);
      if (existing.status !== 'planned') return json({ error: 'Este lançamento já está realizado.' }, 409);
      await db.update(financialTransactions).set({ status: 'realized', settledDate })
        .where(and(eq(financialTransactions.id, id), eq(financialTransactions.organizationId, user.organizationId)));
      await writeAudit(user, 'settle_financial_transaction', 'financial_transaction', id, `${settledDate}: ${existing.description}`);
    } else if (action === 'reconcileBalance') {
      const targetBalance = Number(body.targetBalance);
      const transactionDate = textValue(body.transactionDate) || saoPauloDateKey();
      if (!Number.isFinite(targetBalance) || !datePattern.test(transactionDate)) return json({ error: 'Informe o saldo real da conta e a data da conciliação.' }, 400);
      const rows = await db.select({ type: financialTransactions.type, amount: financialTransactions.amount })
        .from(financialTransactions)
        .where(and(eq(financialTransactions.organizationId, user.organizationId), eq(financialTransactions.status, 'realized')));
      const totals = sumByType(rows);
      const currentBalance = totals.income - totals.expense - totals.investment;
      const difference = Math.round((targetBalance - currentBalance) * 100) / 100;
      if (Math.abs(difference) >= 0.01) {
        const type: TransactionType = difference > 0 ? 'income' : 'expense';
        const [created] = await db.insert(financialTransactions).values({
          organizationId: user.organizationId,
          createdBy: user.id,
          type,
          category: 'Conciliação de saldo',
          description: `Ajuste de conciliação para saldo real de ${targetBalance.toFixed(2)}`,
          amount: Math.abs(difference),
          transactionDate,
          status: 'realized',
          settledDate: transactionDate,
          source: 'balance_adjustment',
          createdAt: new Date().toISOString(),
        }).$returningId();
        await writeAudit(user, 'reconcile_financial_balance', 'financial_transaction', created.id, `saldo ${currentBalance.toFixed(2)} → ${targetBalance.toFixed(2)}`);
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

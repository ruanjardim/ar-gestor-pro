import { and, asc, eq, inArray, like, ne } from 'drizzle-orm';
import { ensureClientDevicesSchema, getDb, migrateLegacyClientDevices } from '@/db';
import { categories, clientDevices, clients, financialTransactions, notes, settings } from '@/db/schema';
import { authErrorResponse, ensureSameOrigin, requireUser, writeAudit } from '@/lib/auth';
import { parseClientDevices } from '@/lib/client-device';
import { isBillingReliefActive, overdueDays, PAYMENT_GRACE_DAYS, type ClientBlockStatus } from '@/lib/client-status';
import { formatBrazilianPhone, isValidBrazilianPhone } from '@/lib/phone';

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
    const devicesReady = await ensureClientDevicesSchema();
    if (devicesReady) await migrateLegacyClientDevices();
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
    let deviceRows: Array<{ id:number; clientId:number; tv:string; app:string; macAddress:string|null; device:string; location:string; sortOrder:number }> = [];
    if (devicesReady) {
      try {
        deviceRows = await db.select({
          id: clientDevices.id, clientId: clientDevices.clientId, tv: clientDevices.tv,
          app: clientDevices.app, macAddress: clientDevices.macAddress, device: clientDevices.device,
          location: clientDevices.location,
          sortOrder: clientDevices.sortOrder,
        }).from(clientDevices).where(eq(clientDevices.organizationId, user.organizationId))
          .orderBy(asc(clientDevices.clientId), asc(clientDevices.sortOrder), asc(clientDevices.id));
      } catch (error) {
        console.error('[data] Clientes carregados sem dispositivos:', error instanceof Error ? error.message : error);
      }
    }
    const devicesByClient = new Map<number, Array<{ id:number; tv:string; app:string; macAddress:string; device:string; location:string }>>();
    for (const row of deviceRows) {
      const devices = devicesByClient.get(row.clientId) ?? [];
      devices.push({
        id: row.id,
        tv: row.tv,
        app: row.app,
        macAddress: row.macAddress ?? '',
        device: row.device,
        location: row.location,
      });
      devicesByClient.set(row.clientId, devices);
    }
    return json({
      clients: clientRows.map((client) => ({ ...client, devices: devicesByClient.get(client.id) ?? [] })),
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
      const phoneValue = String(body.phone ?? '').trim();
      const phone = formatBrazilianPhone(phoneValue);
      const dueDate = String(body.dueDate ?? '').trim();
      const amount = Number(body.amount ?? 0);
      const categoryId = body.categoryId ? Number(body.categoryId) : null;
      let devices;
      try { devices = parseClientDevices(body.devices); }
      catch (error) { return json({ error: error instanceof Error ? error.message : 'TVs e dispositivos inválidos.' }, 400); }
      const devicesReady = await ensureClientDevicesSchema();
      if (devices.length && !devicesReady) return json({ error: 'Não foi possível preparar o cadastro de dispositivos agora. Tente novamente.' }, 503);
      if (!name || !isValidBrazilianPhone(phoneValue) || !dueDate || !Number.isFinite(amount) || amount < 0) {
        return json({ error: 'Preencha nome, telefone, vencimento e valor corretamente.' }, 400);
      }
      if (categoryId) {
        const category = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, categoryId), eq(categories.organizationId, user.organizationId))).limit(1);
        if (!category.length) return json({ error: 'Categoria inválida para esta empresa.' }, 400);
      }
      const macAddresses = devices.map((item) => item.macAddress).filter(Boolean);
      if (devicesReady && macAddresses.length) {
        const [conflicting] = await db.select({ macAddress: clientDevices.macAddress }).from(clientDevices)
          .where(and(eq(clientDevices.organizationId, user.organizationId), inArray(clientDevices.macAddress, macAddresses))).limit(1);
        if (conflicting) return json({ error: `O MAC ${conflicting.macAddress} já pertence a outro cliente desta empresa.` }, 409);
      }
      const createdId = await db.transaction(async (tx) => {
        const [created] = await tx.insert(clients).values({
          organizationId: user.organizationId, name, phone, dueDate, amount,
          telegramChatId: String(body.telegramChatId ?? '').trim() || null,
          categoryId,
          observation: String(body.observation ?? '').trim(),
          createdAt: new Date().toISOString(),
        }).$returningId();
        if (devicesReady && devices.length) {
          const createdAt = new Date().toISOString();
          await tx.insert(clientDevices).values(devices.map((item, sortOrder) => ({
            organizationId: user.organizationId, clientId: created.id, ...item,
            macAddress: item.macAddress || null, sortOrder, createdAt,
          })));
        }
        return created.id;
      });
      await writeAudit(user, 'create_client', 'client', createdId, `${name} · ${devices.length} dispositivo(s)`);
    } else if (action === 'updateClient') {
      const id = Number(body.id);
      const name = String(body.name ?? '').trim();
      const phoneValue = String(body.phone ?? '').trim();
      const phone = formatBrazilianPhone(phoneValue);
      const dueDate = String(body.dueDate ?? '').trim();
      const amount = Number(body.amount ?? 0);
      const categoryId = body.categoryId ? Number(body.categoryId) : null;
      const devicesProvided = body.devices !== undefined;
      let devices;
      try { devices = parseClientDevices(body.devices); }
      catch (error) { return json({ error: error instanceof Error ? error.message : 'TVs e dispositivos inválidos.' }, 400); }
      const devicesReady = await ensureClientDevicesSchema();
      if (devices.length && !devicesReady) return json({ error: 'Não foi possível preparar o cadastro de dispositivos agora. Tente novamente.' }, 503);
      if (!Number.isInteger(id) || !name || !isValidBrazilianPhone(phoneValue) || !dueDate || !Number.isFinite(amount) || amount < 0) {
        return json({ error: 'Preencha nome, telefone, vencimento e valor corretamente.' }, 400);
      }
      if (categoryId) {
        const category = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, categoryId), eq(categories.organizationId, user.organizationId))).limit(1);
        if (!category.length) return json({ error: 'Categoria inválida para esta empresa.' }, 400);
      }
      const [existing] = await db.select({ id: clients.id }).from(clients)
        .where(and(eq(clients.id, id), eq(clients.organizationId, user.organizationId))).limit(1);
      if (!existing) return json({ error: 'Cliente não encontrado.' }, 404);
      const macAddresses = devices.map((item) => item.macAddress).filter(Boolean);
      if (devicesReady && devicesProvided && macAddresses.length) {
        const [conflicting] = await db.select({ macAddress: clientDevices.macAddress }).from(clientDevices)
          .where(and(
            eq(clientDevices.organizationId, user.organizationId), ne(clientDevices.clientId, id),
            inArray(clientDevices.macAddress, macAddresses),
          )).limit(1);
        if (conflicting) return json({ error: `O MAC ${conflicting.macAddress} já pertence a outro cliente desta empresa.` }, 409);
      }
      await db.transaction(async (tx) => {
        await tx.update(clients).set({
          name, phone, dueDate, amount,
          telegramChatId: String(body.telegramChatId ?? '').trim() || null,
          categoryId,
          observation: String(body.observation ?? '').trim(),
        }).where(and(eq(clients.id, id), eq(clients.organizationId, user.organizationId)));
        if (devicesReady && devicesProvided) {
          await tx.delete(clientDevices).where(and(
            eq(clientDevices.clientId, id), eq(clientDevices.organizationId, user.organizationId),
          ));
          if (devices.length) {
            const createdAt = new Date().toISOString();
            await tx.insert(clientDevices).values(devices.map((item, sortOrder) => ({
              organizationId: user.organizationId, clientId: id, ...item,
              macAddress: item.macAddress || null, sortOrder, createdAt,
            })));
          }
        }
      });
      await writeAudit(user, 'update_client', 'client', id, devicesProvided ? `${name} · ${devices.length} dispositivo(s)` : name);
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

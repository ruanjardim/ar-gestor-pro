import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { categories, clients, notes, settings } from '@/db/schema';

export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status });

export async function GET() {
  try {
    const db = getDb();
    const [clientRows, categoryRows, noteRows, settingRows] = await Promise.all([
      db.select({
        id: clients.id, name: clients.name, phone: clients.phone,
        telegramChatId: clients.telegramChatId, categoryId: clients.categoryId,
        categoryName: categories.name, observation: clients.observation,
        dueDate: clients.dueDate, amount: clients.amount,
      }).from(clients).leftJoin(categories, eq(clients.categoryId, categories.id)).orderBy(asc(clients.name)),
      db.select().from(categories).orderBy(asc(categories.name)),
      db.select().from(notes).orderBy(asc(notes.id)),
      db.select().from(settings),
    ]);
    return json({
      clients: clientRows,
      categories: categoryRows,
      notes: noteRows,
      settings: Object.fromEntries(settingRows.map((row) => [row.key, row.value])),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Falha ao carregar os dados.' }, 500);
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; }
  catch { return json({ error: 'Requisição inválida.' }, 400); }
  const db = getDb();
  const action = String(body.action ?? '');
  try {
    if (action === 'createClient') {
      const name = String(body.name ?? '').trim();
      const phone = String(body.phone ?? '').trim();
      const dueDate = String(body.dueDate ?? '').trim();
      const amount = Number(body.amount ?? 0);
      if (!name || !phone || !dueDate || !Number.isFinite(amount) || amount < 0) {
        return json({ error: 'Preencha nome, telefone, vencimento e valor corretamente.' }, 400);
      }
      await db.insert(clients).values({
        name, phone, dueDate, amount,
        telegramChatId: String(body.telegramChatId ?? '').trim() || null,
        categoryId: body.categoryId ? Number(body.categoryId) : null,
        observation: String(body.observation ?? '').trim(),
        createdAt: new Date().toISOString(),
      });
    } else if (action === 'deleteClient') {
      await db.delete(clients).where(eq(clients.id, Number(body.id)));
    } else if (action === 'renewClient') {
      const date = new Date(String(body.dueDate) + 'T12:00:00');
      date.setMonth(date.getMonth() + 1);
      await db.update(clients).set({ dueDate: date.toISOString().slice(0, 10) }).where(eq(clients.id, Number(body.id)));
    } else if (action === 'createCategory') {
      const name = String(body.name ?? '').trim();
      if (!name) return json({ error: 'Informe o nome da categoria.' }, 400);
      await db.insert(categories).values({ name }).onConflictDoNothing();
    } else if (action === 'deleteCategory') {
      const id = Number(body.id);
      await db.batch([
        db.update(clients).set({ categoryId: null }).where(eq(clients.categoryId, id)),
        db.delete(categories).where(eq(categories.id, id)),
      ]);
    } else if (action === 'createNote') {
      const title = String(body.title ?? '').trim();
      const content = String(body.content ?? '').trim();
      if (!title || !content) return json({ error: 'Informe título e conteúdo da nota.' }, 400);
      await db.insert(notes).values({ title, content, createdAt: new Date().toISOString() });
    } else if (action === 'deleteNote') {
      await db.delete(notes).where(eq(notes.id, Number(body.id)));
    } else if (action === 'saveSettings') {
      if (!body.values || typeof body.values !== 'object' || Array.isArray(body.values)) {
        return json({ error: 'Configuração inválida.' }, 400);
      }
      for (const [key, value] of Object.entries(body.values as Record<string, unknown>).slice(0, 40)) {
        await db.insert(settings).values({ key, value: String(value) })
          .onConflictDoUpdate({ target: settings.key, set: { value: String(value) } });
      }
    } else return json({ error: 'Ação desconhecida.' }, 400);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Falha ao salvar.' }, 500);
  }
}

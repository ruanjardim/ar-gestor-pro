import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { clients, messageLogs, organizations, whatsappConnections } from '@/db/schema';
import { getOrganizationSettings, sendClientBillingMessage } from '@/lib/whatsapp';

const weekdayNumbers: Record<string, string> = {
  Mon: '1', Tue: '2', Wed: '3', Thu: '4', Fri: '5', Sat: '6', Sun: '7',
};

function saoPauloNow(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: weekdayNumbers[parts.weekday] || '1',
  };
}

const dayDifference = (dueDate: string, today: string) =>
  Math.round((new Date(`${dueDate}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86_400_000);

const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

function configuredTimes(values: Record<string, string>) {
  const count = Math.max(1, Math.min(3, Number(values.sendCount || 1)));
  const defaults = [values.sendTime || '10:00', '14:00', '18:00'];
  return Array.from({ length: count }, (_, index) => values[`sendTime${index + 1}`] || defaults[index])
    .filter(validTime)
    .filter((value, index, rows) => rows.indexOf(value) === index)
    .sort();
}

function activeSlot(values: Record<string, string>, current: ReturnType<typeof saoPauloNow>, ignoreTime: boolean) {
  if (ignoreTime) return 'manual';
  for (const time of configuredTimes(values)) {
    const [hours, minutes] = time.split(':').map(Number);
    const start = hours * 60 + minutes;
    if (current.minutes >= start && current.minutes < start + 15) return time;
  }
  return null;
}

export async function runOrganizationAutomation(organizationId: number, ignoreTime = false) {
  const db = getDb();
  const values = await getOrganizationSettings(organizationId);
  if (values.whatsappEnabled !== 'true') return { sent: 0, failed: 0, skipped: 0, reason: 'Automação desativada.' };
  const connection = await db.select().from(whatsappConnections).where(eq(whatsappConnections.organizationId, organizationId)).limit(1);
  if (!connection[0] || connection[0].status !== 'connected') return { sent: 0, failed: 0, skipped: 0, reason: 'WhatsApp não conectado.' };

  const current = saoPauloNow();
  const allowedWeekdays = new Set((values.weekdays || '1,2,3,4,5,6,7').split(',').filter((value) => /^[1-7]$/.test(value)));
  if (!ignoreTime && !allowedWeekdays.has(current.weekday)) return { sent: 0, failed: 0, skipped: 0, reason: 'Dia da semana não configurado.' };
  const slot = activeSlot(values, current, ignoreTime);
  if (!slot) return { sent: 0, failed: 0, skipped: 0, reason: 'Fora dos horários configurados.' };

  const daysBefore = Math.max(0, Math.min(30, Number(values.daysBefore || 1)));
  const lateEnabled = values.sendLateMessages === 'true';
  const lateFrequency = Math.max(1, Math.min(30, Number(values.lateFrequencyDays || 3)));
  const scheduledFor = `${current.date}T${slot}`;
  const rows = await db.select().from(clients).where(eq(clients.organizationId, organizationId));
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const client of rows) {
    const difference = dayDifference(client.dueDate, current.date);
    let kind: 'due' | 'late' | null = difference === daysBefore ? 'due' : null;
    if (!kind && lateEnabled && difference < 0 && (Math.abs(difference) - 1) % lateFrequency === 0) kind = 'late';
    if (!kind) continue;
    const existing = await db.select({ id: messageLogs.id }).from(messageLogs).where(and(
      eq(messageLogs.organizationId, organizationId), eq(messageLogs.clientId, client.id),
      eq(messageLogs.kind, kind), eq(messageLogs.scheduledFor, scheduledFor),
    )).limit(1);
    if (existing.length) { skipped += 1; continue; }
    try {
      await sendClientBillingMessage(organizationId, client.id, kind, scheduledFor);
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  return { sent, failed, skipped, slot: scheduledFor };
}

export async function runAllAutomations() {
  const db = getDb();
  const orgRows = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.status, 'active'));
  const results: Array<{ organizationId: number; sent: number; failed: number; skipped: number; reason?: string; slot?: string }> = [];
  for (const organization of orgRows) results.push({ organizationId: organization.id, ...(await runOrganizationAutomation(organization.id)) });
  return results;
}

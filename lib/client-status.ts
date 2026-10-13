export const PAYMENT_GRACE_DAYS = 5;
export const PAID_HIGHLIGHT_MS = 72 * 60 * 60 * 1000;

export type ClientBlockStatus = 'active' | 'temporary_blocked' | 'permanently_blocked';

export type ClientStatusInput = {
  dueDate: string;
  blockStatus?: string | null;
  lastPaidAt?: string | null;
};

export type ClientDisplayStatus = {
  key: 'paid' | 'grace' | 'today' | 'next' | 'current' | 'temporary-blocked' | 'permanently-blocked';
  label: string;
  overdueDays: number;
  isAutomaticBlock: boolean;
};

const dateAtNoon = (value: string) => new Date(`${value}T12:00:00`);

export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function daysUntil(date: string, now = new Date()) {
  return Math.ceil((dateAtNoon(date).getTime() - dateAtNoon(dateKey(now)).getTime()) / 86_400_000);
}

export function overdueDays(date: string, now = new Date()) {
  return Math.max(0, -daysUntil(date, now));
}

export function isRecentlyPaid(lastPaidAt?: string | null, now = new Date()) {
  if (!lastPaidAt) return false;
  const paidAt = new Date(lastPaidAt).getTime();
  const elapsed = now.getTime() - paidAt;
  return Number.isFinite(paidAt) && elapsed >= 0 && elapsed < PAID_HIGHLIGHT_MS;
}

export function clientDisplayStatus(client: ClientStatusInput, now = new Date()): ClientDisplayStatus {
  const overdue = overdueDays(client.dueDate, now);

  if (client.blockStatus === 'permanently_blocked') {
    return { key: 'permanently-blocked', label: 'Bloqueio definitivo', overdueDays: overdue, isAutomaticBlock: false };
  }
  if (isRecentlyPaid(client.lastPaidAt, now)) {
    return { key: 'paid', label: 'Pago', overdueDays: overdue, isAutomaticBlock: false };
  }
  if (overdue > PAYMENT_GRACE_DAYS) {
    return { key: 'permanently-blocked', label: 'Bloqueio definitivo', overdueDays: overdue, isAutomaticBlock: true };
  }
  if (client.blockStatus === 'temporary_blocked') {
    return { key: 'temporary-blocked', label: 'Bloqueio temporário', overdueDays: overdue, isAutomaticBlock: false };
  }
  if (overdue > 0) {
    return { key: 'grace', label: `Carência ${overdue}/${PAYMENT_GRACE_DAYS}`, overdueDays: overdue, isAutomaticBlock: false };
  }

  const remaining = daysUntil(client.dueDate, now);
  if (remaining === 0) return { key: 'today', label: 'Hoje', overdueDays: 0, isAutomaticBlock: false };
  if (remaining <= 7) return { key: 'next', label: 'Próximo', overdueDays: 0, isAutomaticBlock: false };
  return { key: 'current', label: 'Em dia', overdueDays: 0, isAutomaticBlock: false };
}

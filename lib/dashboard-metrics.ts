export type DashboardBuckets<T> = {
  late: T[];
  today: T[];
  next: T[];
  ok: T[];
  relief: T[];
};

export function dashboardBuckets<T>(
  clients: readonly T[],
  daysFromToday: (client: T) => number,
  hasBillingRelief: (client: T) => boolean,
): DashboardBuckets<T> {
  const buckets: DashboardBuckets<T> = {
    late: [],
    today: [],
    next: [],
    ok: [],
    relief: [],
  };

  for (const client of clients) {
    if (hasBillingRelief(client)) {
      buckets.relief.push(client);
      continue;
    }

    const days = daysFromToday(client);
    if (days < 0) buckets.late.push(client);
    else if (days === 0) buckets.today.push(client);
    else if (days <= 7) buckets.next.push(client);
    else buckets.ok.push(client);
  }

  return buckets;
}

export function sumClientAmounts<T extends { amount: number }>(clients: readonly T[]) {
  return clients.reduce((total, client) => total + client.amount, 0);
}

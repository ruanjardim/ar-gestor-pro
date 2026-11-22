import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardBuckets, sumClientAmounts } from '../lib/dashboard-metrics.ts';
import { firstName } from '../lib/user-name.ts';

void test('extrai o primeiro nome real sem inferir a partir do e-mail', () => {
  assert.equal(firstName('  Ruan   Jardim  '), 'Ruan');
  assert.equal(firstName('Érica'), 'Érica');
  assert.equal(firstName(''), null);
  assert.equal(firstName(null), null);
});

void test('mantém as faixas atuais dos indicadores do dashboard', () => {
  const clients = [
    { id: 1, amount: 30, days: -2, relief: false },
    { id: 2, amount: 40, days: 0, relief: false },
    { id: 3, amount: 50, days: 1, relief: false },
    { id: 4, amount: 60, days: 7, relief: false },
    { id: 5, amount: 70, days: 8, relief: false },
    { id: 6, amount: 80, days: -10, relief: true },
  ];
  const buckets = dashboardBuckets(clients, (client) => client.days, (client) => client.relief);

  assert.deepEqual(buckets.late.map((client) => client.id), [1]);
  assert.deepEqual(buckets.today.map((client) => client.id), [2]);
  assert.deepEqual(buckets.next.map((client) => client.id), [3, 4]);
  assert.deepEqual(buckets.ok.map((client) => client.id), [5]);
  assert.deepEqual(buckets.relief.map((client) => client.id), [6]);
  assert.equal(sumClientAmounts(buckets.next), 110);
});

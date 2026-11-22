'use client';

import {
  AlarmClock,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Gift,
  MessageCircle,
  Plus,
  Users,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { type DashboardBuckets, sumClientAmounts } from '@/lib/dashboard-metrics';
import { firstName } from '@/lib/user-name';

type DashboardClient = {
  id: number;
  name: string;
  dueDate: string;
  amount: number;
};

type DashboardOverviewProps = {
  userName: string;
  organizationName: string;
  clients: DashboardClient[];
  counts: DashboardBuckets<DashboardClient>;
  onNewClient: () => void;
  onOpenDue: () => void;
  onOpenWhatsApp: () => void;
};

const money = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(value);

const displayDate = (value: string) => new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
}).format(new Date(`${value}T12:00:00`));

const chartConfig = {
  total: { label: 'Clientes', color: '#1687e8' },
} satisfies ChartConfig;

export function DashboardOverview({
  userName,
  organizationName,
  clients,
  counts,
  onNewClient,
  onOpenDue,
  onOpenWhatsApp,
}: DashboardOverviewProps) {
  const greetingName = firstName(userName);
  const metrics = [
    { label: 'Total de clientes', list: clients, Icon: Users, tone: 'blue' },
    { label: 'Clientes vencidos', list: counts.late, Icon: AlarmClock, tone: 'red' },
    { label: 'Vencendo hoje', list: counts.today, Icon: CalendarDays, tone: 'yellow' },
    { label: 'Vencendo em 7 dias', list: counts.next, Icon: CircleDollarSign, tone: 'violet' },
    { label: 'Clientes em dia', list: counts.ok, Icon: CheckCircle2, tone: 'green' },
    { label: 'Cortesias e isentos', list: counts.relief, Icon: Gift, tone: 'blue' },
  ];
  const chartData = [
    { status: 'Vencidos', total: counts.late.length },
    { status: 'Hoje', total: counts.today.length },
    { status: 'Próximos', total: counts.next.length },
    { status: 'Em dia', total: counts.ok.length },
    { status: 'Benefícios', total: counts.relief.length },
  ];
  const dueAgenda = [...counts.late, ...counts.today, ...counts.next]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);
  const statusOf = (client: DashboardClient) => counts.late.some(item => item.id === client.id)
    ? 'Vencido'
    : counts.today.some(item => item.id === client.id) ? 'Hoje' : 'Próximo';

  return (
    <>
      <header className="dashboard-welcome">
        <div>
          <span className="dashboard-overline">Visão geral · {organizationName}</span>
          <h1>Olá{greetingName ? `, ${greetingName}` : ''}!</h1>
          <p>Acompanhe os pontos que precisam da sua atenção hoje.</p>
        </div>
        <Button className="dashboard-primary-action" onClick={onNewClient}><Plus />Adicionar cliente</Button>
      </header>

      <section className="metric-grid metric-grid-modern" aria-label="Indicadores da carteira de clientes">
        {metrics.map(({ label, list, Icon, tone }) => (
          <Card className={`metric-card tone-${tone}`} key={label}><CardContent>
            <div className="metric-icon"><Icon /></div>
            <div className="metric-copy"><span className="metric-label">{label}</span><strong className="metric-value">{list.length}</strong><span className="metric-amount">{money(sumClientAmounts(list))}</span></div>
          </CardContent></Card>
        ))}
      </section>

      <section className="dashboard-insights">
        <Card className="content-card dashboard-chart-card"><CardContent>
          <div className="dashboard-card-heading"><div><span>Carteira de clientes</span><h2>Distribuição por situação</h2></div><small>{clients.length} cliente(s) no total</small></div>
          <ChartContainer config={chartConfig} className="dashboard-status-chart" initialDimension={{ width: 640, height: 270 }}>
            <BarChart accessibilityLayer data={chartData} layout="vertical" margin={{ left: 4, right: 16 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <YAxis dataKey="status" type="category" tickLine={false} axisLine={false} width={74} />
              <XAxis dataKey="total" type="number" allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="total" name="Clientes" fill="var(--color-total)" radius={[0, 6, 6, 0]} maxBarSize={24} />
            </BarChart>
          </ChartContainer>
        </CardContent></Card>

        <Card className="content-card dashboard-agenda-card"><CardContent>
          <div className="dashboard-card-heading"><div><span>Prioridades</span><h2>Agenda de vencimentos</h2></div><Button size="sm" variant="outline" onClick={onOpenDue}>Ver todos</Button></div>
          <div className="dashboard-agenda-list">
            {dueAgenda.length ? dueAgenda.map(client => <button type="button" onClick={onOpenDue} key={client.id}>
              <span className={`agenda-dot agenda-${statusOf(client).toLowerCase()}`} />
              <span><strong>{client.name}</strong><small>{statusOf(client)} · {displayDate(client.dueDate)}</small></span>
              <b>{money(client.amount)}</b>
            </button>) : <div className="dashboard-empty"><CheckCircle2 /><strong>Nenhuma pendência próxima</strong><span>Sua agenda está em dia.</span></div>}
          </div>
        </CardContent></Card>
      </section>

      <section className="dashboard-quick-bar" aria-label="Ações rápidas">
        <div><span>Ações rápidas</span><strong>Continue de onde sua operação precisa.</strong></div>
        <div><Button onClick={onNewClient}><Plus />Novo cliente</Button><Button variant="outline" onClick={onOpenDue}><CalendarDays />Vencimentos</Button><Button variant="outline" onClick={onOpenWhatsApp}><MessageCircle />Cobrar pelo WhatsApp</Button></div>
      </section>
    </>
  );
}

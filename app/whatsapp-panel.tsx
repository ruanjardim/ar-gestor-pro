'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  AlarmClock, CheckCircle2, History, KeyRound, MessageCircle, QrCode,
  RefreshCw, Send, Settings2, ShieldCheck, Smartphone, WalletCards,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type BillingClient = {
  id: number;
  name: string;
  phone: string;
  telegramChatId: string | null;
  categoryId: number | null;
  categoryName: string | null;
  observation: string;
  dueDate: string;
  amount: number;
};

type WhatsAppConnection = {
  provider: 'meta' | 'evolution';
  displayPhone: string;
  status: string;
  verifiedName: string;
  lastCheckedAt: string | null;
  hasSecret: boolean;
  baseUrl?: string;
  instanceName?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  templateName?: string;
  templateLanguage?: string;
};

type MessageLog = {
  id: number;
  clientId: number | null;
  kind: string;
  status: string;
  recipient: string;
  messagePreview: string;
  error: string;
  scheduledFor: string | null;
  createdAt: string;
};

type WhatsAppSummary = { connection: WhatsAppConnection | null; logs: MessageLog[] };

type AutomationSettingsProps = {
  settings: Record<string, string>;
  onSave: (values: Record<string, string | boolean>) => Promise<void>;
  onNotice: (message: string) => void;
};

type WhatsAppPanelProps = AutomationSettingsProps & {
  organizationName: string;
  isMaster: boolean;
  clients: BillingClient[];
  onAssisted: (client: BillingClient) => void;
  onOpenMessages: () => void;
  onOpenPix: () => void;
};

const weekDays = [
  ['1', 'Seg'], ['2', 'Ter'], ['3', 'Qua'], ['4', 'Qui'],
  ['5', 'Sex'], ['6', 'Sáb'], ['7', 'Dom'],
] as const;

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const today = () => new Date().toISOString().slice(0, 10);
const diffDays = (date: string) => Math.ceil((new Date(`${date}T12:00:00`).getTime() - new Date(`${today()}T12:00:00`).getTime()) / 86_400_000);
const statusOf = (date: string) => diffDays(date) < 0 ? 'Vencido' : diffDays(date) === 0 ? 'Hoje' : diffDays(date) <= 7 ? 'Próximo' : 'Em dia';
const statusClass = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll(' ', '-');
const maskedPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.length > 4 ? `${'*'.repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}` : value;
};
const formText = (form: FormData, key: string, fallback = '') => {
  const value = form.get(key);
  return typeof value === 'string' && value ? value : fallback;
};
const resultCount = (value: unknown) => typeof value === 'number' ? value : 0;
const deliveryStatusLabel = (status: string) => ({
  sent: 'Enviada', delivered: 'Entregue', read: 'Lida', failed: 'Falhou', processing: 'Processando',
} as Record<string, string>)[status] || status;

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <Card className={`content-card ${className}`}><CardContent>{children}</CardContent></Card>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field-label"><span>{label}</span>{children}</label>;
}

export function AutomationSettingsForm({ settings, onSave, onNotice }: AutomationSettingsProps) {
  const enabledDays = new Set((settings.weekdays || '1,2,3,4,5,6,7').split(',').filter(Boolean));
  const formKey = [settings.whatsappEnabled, settings.sendCount, settings.sendTime1, settings.sendTime2, settings.sendTime3, settings.weekdays, settings.daysBefore, settings.sendLateMessages, settings.lateFrequencyDays, settings.includePix].join('-');

  const submit = async (event: { preventDefault: () => void; currentTarget: HTMLFormElement }) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const whatsappEnabled = form.get('whatsappEnabled') === 'on';
    const weekdays = weekDays.filter(([value]) => form.get(`weekday-${value}`) === 'on').map(([value]) => value);
    if (!weekdays.length) {
      onNotice('Escolha pelo menos um dia da semana.');
      return;
    }
    if (whatsappEnabled && settings.whatsappEnabled !== 'true' && !window.confirm('Ativar a automação permitirá o envio de cobranças reais nos horários escolhidos quando o WhatsApp estiver conectado. Deseja continuar?')) return;
    await onSave({
      whatsappEnabled,
      sendCount: formText(form, 'sendCount', '1'),
      sendTime1: formText(form, 'sendTime1', '10:00'),
      sendTime2: formText(form, 'sendTime2', '14:00'),
      sendTime3: formText(form, 'sendTime3', '18:00'),
      weekdays: weekdays.join(','),
      daysBefore: formText(form, 'daysBefore', '1'),
      sendLateMessages: form.get('sendLateMessages') === 'on',
      lateFrequencyDays: formText(form, 'lateFrequencyDays', '3'),
      includePix: form.get('includePix') === 'on',
    });
  };

  return <form key={formKey} className="settings-grid automation-settings" onSubmit={submit}>
    <Panel>
      <div className="card-title-row"><div><h3>Automação do WhatsApp</h3><p>Envia cobranças sem precisar abrir cada conversa.</p></div><AlarmClock /></div>
      <label className="toggle-row"><input aria-label="Ativar cobranças automáticas" type="checkbox" name="whatsappEnabled" defaultChecked={settings.whatsappEnabled === 'true'} /><span><strong>Ativar cobranças automáticas</strong><small>Funciona somente com uma conexão verificada.</small></span></label>
      <label className="toggle-row"><input aria-label="Incluir PIX na mensagem" type="checkbox" name="includePix" defaultChecked={settings.includePix !== 'false'} /><span><strong>Incluir PIX na mensagem</strong><small>Usa os dados cadastrados na área PIX.</small></span></label>
      <label className="toggle-row"><input aria-label="Cobrar clientes vencidos" type="checkbox" name="sendLateMessages" defaultChecked={settings.sendLateMessages === 'true'} /><span><strong>Cobrar clientes vencidos</strong><small>Repete conforme a frequência definida, sem duplicar a mesma janela.</small></span></label>
      <Field label="Repetir vencidos a cada"><select name="lateFrequencyDays" defaultValue={settings.lateFrequencyDays || '3'}><option value="1">1 dia</option><option value="2">2 dias</option><option value="3">3 dias</option><option value="7">7 dias</option><option value="15">15 dias</option></select></Field>
    </Panel>
    <Panel>
      <div className="card-title-row"><div><h3>Agenda de envios</h3><p>Horário de Brasília, com até três janelas por dia.</p></div><Settings2 /></div>
      <Field label="Quantidade de envios por dia"><select name="sendCount" defaultValue={settings.sendCount || '1'}><option value="1">1 envio</option><option value="2">2 envios</option><option value="3">3 envios</option></select></Field>
      <div className="time-grid"><Field label="1º horário"><Input type="time" name="sendTime1" defaultValue={settings.sendTime1 || settings.sendTime || '10:00'} required /></Field><Field label="2º horário"><Input type="time" name="sendTime2" defaultValue={settings.sendTime2 || '14:00'} /></Field><Field label="3º horário"><Input type="time" name="sendTime3" defaultValue={settings.sendTime3 || '18:00'} /></Field></div>
      <Field label="Cobrar antes do vencimento"><select name="daysBefore" defaultValue={settings.daysBefore || '1'}><option value="0">No próprio dia</option><option value="1">1 dia antes</option><option value="3">3 dias antes</option><option value="7">7 dias antes</option></select></Field>
      <fieldset className="weekday-field"><legend>Dias da semana</legend><div>{weekDays.map(([value, label]) => <label key={value}><input type="checkbox" name={`weekday-${value}`} defaultChecked={enabledDays.has(value)} /><span>{label}</span></label>)}</div></fieldset>
    </Panel>
    <p className="security-note automation-note"><ShieldCheck />Cada cliente recebe no máximo uma mensagem por horário configurado. Falhas ficam registradas para conferência.</p>
    <Button type="submit" className="settings-save"><CheckCircle2 />Salvar automação</Button>
  </form>;
}

export default function WhatsAppPanel({ organizationName, isMaster, clients, settings, onSave, onNotice, onAssisted, onOpenMessages, onOpenPix }: WhatsAppPanelProps) {
  const [summary, setSummary] = useState<WhatsAppSummary>({ connection: null, logs: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [qrCode, setQrCode] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/whatsapp', { cache: 'no-store' });
      const result = await response.json() as WhatsAppSummary & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar a integração.');
      setSummary(result);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Não foi possível carregar a integração.');
    } finally {
      setLoading(false);
    }
  }, [onNotice]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const action = async (name: string, payload: Record<string, unknown> = {}) => {
    setBusy(name);
    try {
      const response = await fetch('/api/whatsapp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: name, ...payload }) });
      const result = await response.json() as Record<string, unknown> & { error?: string };
      if (!response.ok) throw new Error(result.error || 'A operação não foi concluída.');
      if (name === 'getQr') setQrCode(typeof result.qrCode === 'string' ? result.qrCode : '');
      else await load();
      return result;
    } finally {
      setBusy('');
    }
  };

  const saveEvolutionConnection = async (event: { preventDefault: () => void; currentTarget: HTMLFormElement }) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await action('saveConnection', {
        provider: 'evolution',
        displayPhone: form.get('displayPhone'),
        baseUrl: form.get('baseUrl'),
        instanceName: form.get('instanceName'),
        apiKey: form.get('apiKey'),
      });
      onNotice('Integração salva. Agora verifique a conexão ou gere o QR Code.');
    } catch (error) { onNotice(error instanceof Error ? error.message : 'Não foi possível salvar a integração.'); }
  };

  const saveMetaConnection = async (event: { preventDefault: () => void; currentTarget: HTMLFormElement }) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!window.confirm('Trocar para a Meta Cloud API? A conexão atual só será substituída depois que número, conta e modelo aprovado forem validados.')) return;
    try {
      await action('saveConnection', {
        provider: 'meta',
        accessToken: form.get('accessToken'),
        phoneNumberId: form.get('phoneNumberId'),
        businessAccountId: form.get('businessAccountId'),
        templateName: form.get('templateName'),
        templateLanguage: form.get('templateLanguage'),
      });
      onNotice('Meta Cloud API validada e conectada com um modelo aprovado.');
    } catch (error) { onNotice(error instanceof Error ? error.message : 'Não foi possível validar a Meta Cloud API.'); }
  };

  const connection = summary.connection;
  const connected = connection?.status === 'connected';
  const leadDays = Number(settings.daysBefore || '1');
  const queue = useMemo(() => [...clients].filter(client => diffDays(client.dueDate) <= leadDays).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [clients, leadDays]);
  const clientNames = useMemo(() => new Map(clients.map(client => [client.id, client.name])), [clients]);

  const sendNow = async (client: BillingClient) => {
    if (!window.confirm(`Enviar agora uma cobrança real para ${client.name}?`)) return;
    try {
      await action('sendClient', { clientId: client.id, kind: diffDays(client.dueDate) < 0 ? 'late' : 'due' });
      onNotice(`Cobrança enviada para ${client.name}.`);
    } catch (error) { onNotice(error instanceof Error ? error.message : 'Não foi possível enviar a cobrança.'); }
  };

  const chargeTable = (rows: BillingClient[]) => <Panel><Table className="responsive-table"><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Vencimento</TableHead><TableHead>Valor</TableHead><TableHead>Situação</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{rows.length ? rows.map(client => <TableRow key={client.id}><TableCell data-label="Cliente"><strong>{client.name}</strong><small>{client.categoryName || 'Sem categoria'}</small></TableCell><TableCell data-label="Vencimento">{new Date(`${client.dueDate}T12:00:00`).toLocaleDateString('pt-BR')}</TableCell><TableCell data-label="Valor">{money(client.amount)}</TableCell><TableCell data-label="Situação"><span className={`status status-${statusClass(statusOf(client.dueDate))}`}>{statusOf(client.dueDate)}</span></TableCell><TableCell data-label="Ações"><div className="row-actions"><Button size="sm" variant="outline" onClick={() => onAssisted(client)}><MessageCircle />Abrir cobrança</Button>{connected && <Button size="sm" disabled={Boolean(busy)} onClick={() => void sendNow(client)}><Send />Enviar agora</Button>}</div></TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="empty-cell">Nenhum cliente nesta fila.</TableCell></TableRow>}</TableBody></Table></Panel>;

  return <>
    <div className="page-heading"><div className="page-icon"><MessageCircle /></div><h1>Cobranças pelo WhatsApp</h1><p>Envio assistido ou automático para os clientes de {organizationName}</p></div>
    <Tabs defaultValue="status"><TabsList className="wa-tabs"><TabsTrigger value="status">Status</TabsTrigger><TabsTrigger value="automation">Automação</TabsTrigger><TabsTrigger value="queue">Fila ({queue.length})</TabsTrigger><TabsTrigger value="sent">Histórico ({summary.logs.length})</TabsTrigger></TabsList>
      <TabsContent value="status"><div className="whatsapp-status-grid"><Panel><div className="connection-card"><span className={`connection-dot ${connected ? 'connected' : ''}`} /><div><h2>{loading ? 'Verificando conexão...' : connected ? 'WhatsApp conectado' : connection ? 'Conexão pendente' : 'WhatsApp não configurado'}</h2><p>{connected ? `${connection?.displayPhone || connection?.verifiedName || 'Conexão verificada'} pronta para enviar.` : 'Configure a Meta Cloud API oficial ou mantenha a Evolution como contingência.'}</p></div></div>{connection && <div className="connection-details"><span>Provedor<strong>{connection.provider === 'evolution' ? 'Evolution API' : 'Meta Cloud API'}</strong></span><span>Conta<strong>{connection.instanceName || connection.verifiedName || '—'}</strong></span><span>Última verificação<strong>{connection.lastCheckedAt ? new Date(connection.lastCheckedAt).toLocaleString('pt-BR') : 'Ainda não verificada'}</strong></span></div>}<div className="quick-actions"><Button variant="outline" disabled={!connection || Boolean(busy)} onClick={() => void action('testConnection').then(() => onNotice('Conexão verificada com sucesso.')).catch(error => onNotice((error as Error).message))}><RefreshCw />Verificar conexão</Button>{connection?.provider === 'evolution' && <Button variant="outline" disabled={Boolean(busy)} onClick={() => void action('getQr').catch(error => onNotice((error as Error).message))}><QrCode />Gerar QR Code</Button>}</div>{qrCode && <div className="qr-card"><Image src={qrCode} width={164} height={164} unoptimized alt="QR Code para conectar o WhatsApp" /><div><strong>Escaneie no WhatsApp</strong><p>Acesse Dispositivos conectados e escolha Conectar dispositivo.</p></div></div>}</Panel>
        <Panel><div className="card-title-row"><div><h2>Conectar Meta Cloud API</h2><p>Canal oficial, com validação do número e do modelo antes da troca.</p></div><ShieldCheck /></div>{isMaster ? <form key={`meta-${connection?.phoneNumberId || ''}-${connection?.businessAccountId || ''}`} className="stack-form" onSubmit={saveMetaConnection}><Field label="Phone Number ID"><Input name="phoneNumberId" inputMode="numeric" defaultValue={connection?.provider === 'meta' ? connection.phoneNumberId : ''} required /></Field><Field label="WhatsApp Business Account ID"><Input name="businessAccountId" inputMode="numeric" defaultValue={connection?.provider === 'meta' ? connection.businessAccountId : ''} required /></Field><Field label="Token de acesso permanente"><Input type="password" name="accessToken" required={connection?.provider !== 'meta' || !connection.hasSecret} placeholder={connection?.provider === 'meta' && connection.hasSecret ? 'Deixe em branco para manter o token atual' : 'Informe o token do usuário do sistema'} /></Field><Field label="Modelo aprovado"><Input name="templateName" defaultValue={connection?.provider === 'meta' ? connection.templateName : 'ar_gestor_cobranca_v1'} required /></Field><Field label="Idioma do modelo"><Input name="templateLanguage" defaultValue={connection?.provider === 'meta' ? connection.templateLanguage : 'pt_BR'} required /></Field><Button type="submit" disabled={Boolean(busy)}><Smartphone />Validar e conectar Meta</Button></form> : <p className="security-note"><ShieldCheck />Somente um usuário Master pode alterar a integração.</p>}<p className="security-note"><ShieldCheck />O token é criptografado. A conexão atual permanece intacta se a validação falhar.</p></Panel>
        <Panel><div className="card-title-row"><div><h2>Evolution API (contingência)</h2><p>Mantenha esta opção até a Meta estar validada.</p></div><KeyRound /></div>{isMaster ? <form key={`${connection?.baseUrl || ''}-${connection?.instanceName || ''}`} className="stack-form" onSubmit={saveEvolutionConnection}><Field label="URL segura da Evolution"><Input type="url" name="baseUrl" placeholder="https://evolution.seudominio.com.br" defaultValue={connection?.provider === 'evolution' ? connection.baseUrl : ''} required /></Field><Field label="Nome da instância"><Input name="instanceName" defaultValue={connection?.provider === 'evolution' ? connection.instanceName : ''} required /></Field><Field label="Chave da API"><Input type="password" name="apiKey" placeholder={connection?.provider === 'evolution' && connection.hasSecret ? 'Deixe em branco para manter a chave atual' : 'Informe a chave da instância'} /></Field><Field label="Número conectado (opcional)"><Input name="displayPhone" defaultValue={connection?.provider === 'evolution' ? connection.displayPhone : ''} placeholder="55 21 99999-9999" /></Field><Button type="submit" disabled={Boolean(busy)}><Smartphone />Salvar integração</Button></form> : <p className="security-note"><ShieldCheck />Somente um usuário Master pode alterar a integração.</p>}<p className="provider-warning">A Evolution usa uma conexão não oficial. O serviço externo não será removido até a Meta estar validada.</p></Panel></div></TabsContent>
      <TabsContent value="automation"><div className="automation-stack"><AutomationSettingsForm settings={settings} onSave={onSave} onNotice={onNotice} /><Panel><div className="card-title-row"><div><h3>Executar fora do horário</h3><p>Use apenas para validar uma configuração já conectada. O sistema mantém a proteção por janela.</p></div><Send /></div><Button disabled={!connected || settings.whatsappEnabled !== 'true' || Boolean(busy)} onClick={() => { if (window.confirm('Executar agora pode enviar cobranças reais aos clientes elegíveis. Deseja continuar?')) void action('runAutomationNow').then(result => onNotice(`Execução concluída: ${resultCount(result.sent)} enviada(s), ${resultCount(result.skipped)} ignorada(s), ${resultCount(result.failed)} falha(s).`)).catch(error => onNotice((error as Error).message)); }}><Send />Executar automação agora</Button></Panel></div></TabsContent>
      <TabsContent value="queue"><div className="assisted-banner content-card"><CardContent><div className="ownership-card"><ShieldCheck /><div><h2>Fila com contingência assistida</h2><p>Se a integração estiver indisponível, “Abrir cobrança” continua montando o texto com vencimento, valor e PIX para você confirmar no WhatsApp.</p></div></div><div className="quick-actions"><Button variant="outline" onClick={onOpenMessages}>Editar mensagens</Button><Button variant="outline" onClick={onOpenPix}><WalletCards />Conferir PIX</Button></div></CardContent></div>{chargeTable(queue)}</TabsContent>
      <TabsContent value="sent"><Panel><div className="card-title-row"><div><h2>Histórico de envios</h2><p>Registros da empresa, incluindo falhas e execuções agendadas.</p></div><History /></div><Table className="responsive-table"><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Destino</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead><TableHead>Detalhe</TableHead></TableRow></TableHeader><TableBody>{summary.logs.length ? summary.logs.map(log => <TableRow key={log.id}><TableCell data-label="Cliente">{log.clientId ? clientNames.get(log.clientId) || 'Cliente removido' : 'Teste'}</TableCell><TableCell data-label="Destino">{maskedPhone(log.recipient)}</TableCell><TableCell data-label="Tipo">{log.kind === 'late' ? 'Vencido' : log.kind === 'renew' ? 'Renovação' : log.kind === 'test' ? 'Teste' : 'Vencimento'}</TableCell><TableCell data-label="Status"><span className={`delivery-status ${log.status}`}>{deliveryStatusLabel(log.status)}</span></TableCell><TableCell data-label="Data">{new Date(log.createdAt).toLocaleString('pt-BR')}</TableCell><TableCell data-label="Detalhe"><small title={log.error || log.messagePreview}>{log.error || log.messagePreview}</small></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="empty-cell">Nenhuma mensagem automática foi registrada.</TableCell></TableRow>}</TableBody></Table></Panel></TabsContent>
    </Tabs>
  </>;
}

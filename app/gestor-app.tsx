'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlarmClock, BarChart3, Bell, CalendarDays, CheckCircle2, CircleDollarSign,
  CreditCard, Download, FileText, FileUp, Gem, LayoutDashboard, Menu,
  MessageCircle, MessagesSquare, Moon, Plus, RefreshCw, Search, Settings,
  ShieldCheck, StickyNote, Sun, Tags, Trash2, Users, WalletCards, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger, useSidebar,
} from '@/components/ui/sidebar';

type View = 'dashboard'|'clients'|'categories'|'search'|'due'|'notes'|'reports'|'charts'|'reminders'|'export'|'whatsapp'|'messages'|'pix'|'billing'|'profile';
type Category = { id:number; name:string };
type Client = { id:number; name:string; phone:string; telegramChatId:string|null; categoryId:number|null; categoryName:string|null; observation:string; dueDate:string; amount:number };
type Note = { id:number; title:string; content:string; createdAt:string };
type DataState = { clients:Client[]; categories:Category[]; notes:Note[]; settings:Record<string,string> };
type WebMcpTool = {
  name:string;
  description:string;
  inputSchema:Record<string,unknown>;
  execute:(input:Record<string,unknown>)=>Promise<unknown>|unknown;
};
type WebMcpDocument = Document & {
  modelContext?: { registerTool:(tool:WebMcpTool,options?:{signal?:AbortSignal})=>Promise<void>|void };
};

const views: Array<{key:View; label:string; icon:typeof LayoutDashboard}> = [
  {key:'dashboard',label:'Dashboard',icon:LayoutDashboard},{key:'clients',label:'Meus Clientes',icon:Users},
  {key:'categories',label:'Categorias',icon:Tags},{key:'search',label:'Busca',icon:Search},
  {key:'due',label:'Vencimentos',icon:CalendarDays},{key:'notes',label:'Bloco de Notas',icon:StickyNote},
  {key:'reports',label:'Relatórios PDF',icon:FileText},{key:'charts',label:'Gráficos',icon:BarChart3},
  {key:'reminders',label:'Dias de Cobrança',icon:AlarmClock},{key:'export',label:'Exportar',icon:FileUp},
  {key:'whatsapp',label:'Status WhatsApp',icon:MessageCircle},{key:'messages',label:'Gerenciar Mensagens',icon:MessagesSquare},
  {key:'pix',label:'PIX',icon:Gem},{key:'billing',label:'Assinatura',icon:CreditCard},{key:'profile',label:'Perfil',icon:Settings},
];

const emptyData:DataState={clients:[],categories:[],notes:[],settings:{}};
const defaults={
  dueMessage:'Olá {nome}, lembramos que sua fatura vence hoje (dia {vencimento}), no valor de R$ {valor}.',
  lateMessage:'Olá {nome}, sua fatura venceu no dia {vencimento}, no valor de R$ {valor}. Entre em contato para regularizar.',
  renewMessage:'Olá {nome}, sua fatura foi renovada! Novo vencimento: {vencimento}, valor: R$ {valor}.',
};
const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
const today=()=>new Date().toISOString().slice(0,10);
const diffDays=(date:string)=>Math.ceil((new Date(date+'T12:00:00').getTime()-new Date(today()+'T12:00:00').getTime())/86400000);
const statusOf=(date:string)=>diffDays(date)<0?'Vencido':diffDays(date)===0?'Hoje':diffDays(date)<=7?'Próximo':'Em dia';

function Heading({icon:Icon,title,subtitle}:{icon:typeof LayoutDashboard;title:string;subtitle:string}) {
  return <div className="page-heading"><div className="page-icon"><Icon/></div><h1>{title}</h1><p>{subtitle}</p></div>;
}
function Panel({children,className=''}:{children:React.ReactNode;className?:string}) {
  return <Card className={'content-card '+className}><CardContent>{children}</CardContent></Card>;
}
function Field({label,children}:{label:string;children:React.ReactNode}) {
  return <label className="field-label"><span>{label}</span>{children}</label>;
}
function Navigation({view,onSelect}:{view:View;onSelect:(key:View)=>void}) {
  const {isMobile,setOpenMobile}=useSidebar();
  const select=(key:View)=>{
    onSelect(key);
    if(isMobile) setOpenMobile(false);
  };
  return <SidebarMenu className="nav-menu">{views.map(({key,label,icon:Icon})=><SidebarMenuItem key={key}><SidebarMenuButton isActive={view===key} tooltip={label} onClick={()=>select(key)}><Icon/><span>{label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu>;
}

export default function GestorApp() {
  const [view,setView]=useState<View>('dashboard');
  const [data,setData]=useState<DataState>(emptyData);
  const [customerOpen,setCustomerOpen]=useState(false);
  const [notice,setNotice]=useState('');
  const [dark,setDark]=useState(true);
  const [query,setQuery]=useState('');
  const [filterStatus,setFilterStatus]=useState('Todos');

  const load=async()=>{
    try {
      const response=await fetch('/api/data',{cache:'no-store'});
      if(!response.ok) throw new Error();
      setData(await response.json() as DataState);
    } catch { setNotice('A visualização está pronta; o banco será ativado na publicação privada.'); }
  };
  useEffect(()=>{void load()},[]);
  const mutate=async(action:string,payload:Record<string,unknown>)=>{
    const response=await fetch('/api/data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...payload})});
    const result=await response.json() as {error?:string};
    if(!response.ok) throw new Error(result.error||'Não foi possível salvar.');
    await load();
  };
  useEffect(()=>{
    const modelContext=(document as WebMcpDocument).modelContext;
    if(!modelContext?.registerTool) return;
    const controller=new AbortController();
    const register=async()=>{
      await modelContext.registerTool({
        name:'get_ar_gestor_summary',
        description:'Retorna um resumo sem dados pessoais da situação atual da AR Gestor Pro.',
        inputSchema:{type:'object',properties:{},additionalProperties:false},
        execute:async()=>{
          const response=await fetch('/api/data',{cache:'no-store'});
          const current=await response.json() as DataState;
          return {
            totalClientes:current.clients.length,
            vencidos:current.clients.filter(client=>diffDays(client.dueDate)<0).length,
            vencendoHoje:current.clients.filter(client=>diffDays(client.dueDate)===0).length,
            vencendoEmSeteDias:current.clients.filter(client=>diffDays(client.dueDate)>0&&diffDays(client.dueDate)<=7).length,
          };
        },
      },{signal:controller.signal});
      await modelContext.registerTool({
        name:'create_ar_gestor_client',
        description:'Cadastra um cliente na base privada da AR Gestor Pro.',
        inputSchema:{
          type:'object',
          properties:{
            name:{type:'string',description:'Nome do cliente'},
            phone:{type:'string',description:'Telefone com DDD'},
            dueDate:{type:'string',description:'Data de vencimento no formato AAAA-MM-DD'},
            amount:{type:'number',description:'Valor em reais'},
            observation:{type:'string',description:'Observação opcional'},
          },
          required:['name','phone','dueDate','amount'],
          additionalProperties:false,
        },
        execute:async input=>{
          await mutate('createClient',input);
          setView('clients');
          return {ok:true,message:'Cliente cadastrado na base privada.'};
        },
      },{signal:controller.signal});
    };
    void register().catch(()=>undefined);
    return ()=>controller.abort();
  },[]);
  const total=useMemo(()=>data.clients.reduce((sum,c)=>sum+c.amount,0),[data.clients]);
  const counts=useMemo(()=>({
    late:data.clients.filter(c=>diffDays(c.dueDate)<0),
    today:data.clients.filter(c=>diffDays(c.dueDate)===0),
    next:data.clients.filter(c=>diffDays(c.dueDate)>0&&diffDays(c.dueDate)<=7),
    ok:data.clients.filter(c=>diffDays(c.dueDate)>7),
  }),[data.clients]);
  const filtered=useMemo(()=>data.clients.filter(c=>{
    const text=(c.name+' '+c.phone+' '+(c.categoryName||'')+' '+c.observation).toLowerCase();
    return text.includes(query.toLowerCase())&&(filterStatus==='Todos'||statusOf(c.dueDate)===filterStatus);
  }),[data.clients,query,filterStatus]);
  const saveSettings=async(values:Record<string,string|boolean>)=>{try{await mutate('saveSettings',{values});setNotice('Configurações salvas.')}catch(e){setNotice((e as Error).message)}};
  const dashboardMetrics:Array<{label:string;list:Client[];Icon:typeof LayoutDashboard;tone:string}> = [
    {label:'Total de clientes',list:data.clients,Icon:Users,tone:'blue'},
    {label:'Clientes vencidos',list:counts.late,Icon:AlarmClock,tone:'red'},
    {label:'Vencendo hoje',list:counts.today,Icon:CalendarDays,tone:'yellow'},
    {label:'Vencendo em 7 dias',list:counts.next,Icon:CircleDollarSign,tone:'violet'},
    {label:'Clientes em dia',list:counts.ok,Icon:CheckCircle2,tone:'green'},
  ];

  const dashboard=<>
    <Heading icon={LayoutDashboard} title="Dashboard" subtitle="Visão geral do seu painel de clientes"/>
    <section className="metric-grid" aria-label="Resumo financeiro">
      {dashboardMetrics.map(({label,list,Icon,tone})=><Card className={'metric-card tone-'+tone} key={label}><CardContent>
        <div className="metric-icon"><Icon/></div><strong className="metric-value">{list.length}</strong>
        <span className="metric-label">{label}</span><span className="metric-amount">{money(list.reduce((s,c)=>s+c.amount,0))}</span>
      </CardContent></Card>)}
    </section>
    <Panel className="distribution-card"><div className="distribution-grid"><div><h2>Distribuição dos Clientes</h2><p>Acompanhe vencimentos e recebimentos em um só lugar.</p>
      <div className="legend"><span><i className="dot red"/>Vencidos ({counts.late.length})</span><span><i className="dot yellow"/>Hoje ({counts.today.length})</span><span><i className="dot violet"/>Próximos ({counts.next.length})</span><span><i className="dot green"/>Em dia ({counts.ok.length})</span></div>
    </div><div className="donut"><strong>{data.clients.length}</strong><span>Total</span></div></div></Panel>
    <div className="quick-actions"><Button onClick={()=>{setView('clients');setCustomerOpen(true)}}><Plus/>Adicionar Cliente</Button><Button variant="outline" onClick={()=>setView('due')}><CalendarDays/>Vencimentos</Button><Button variant="outline" onClick={()=>setView('whatsapp')}><MessageCircle/>Conectar WhatsApp</Button></div>
  </>;

  const clientTable=(rows:Client[])=><Panel><Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead>Categoria</TableHead><TableHead>Vencimento</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
    <TableBody>{rows.length?rows.map(c=><TableRow key={c.id}><TableCell><strong>{c.name}</strong><small>{c.observation}</small></TableCell><TableCell>{c.phone}</TableCell><TableCell>{c.categoryName||'Sem categoria'}</TableCell><TableCell>{new Date(c.dueDate+'T12:00:00').toLocaleDateString('pt-BR')}</TableCell><TableCell>{money(c.amount)}</TableCell><TableCell><span className={'status status-'+statusOf(c.dueDate).toLowerCase().replace('ó','o').replaceAll(' ','-')}>{statusOf(c.dueDate)}</span></TableCell><TableCell><div className="row-actions"><Button size="sm" variant="outline" onClick={()=>void mutate('renewClient',{id:c.id,dueDate:c.dueDate})}><RefreshCw/>Renovar</Button><Button aria-label={'Excluir '+c.name} size="icon-sm" variant="destructive" onClick={()=>{if(confirm('Excluir este cliente?'))void mutate('deleteClient',{id:c.id})}}><Trash2/></Button></div></TableCell></TableRow>):<TableRow><TableCell colSpan={7} className="empty-cell">Nenhum cliente cadastrado ainda.</TableCell></TableRow>}</TableBody>
  </Table></Panel>;

  const clients=<><Heading icon={Users} title="Meus Clientes" subtitle="Clientes cadastrados nesta base privada"/><div className="section-toolbar"><span>{data.clients.length} cliente(s)</span><Button onClick={()=>setCustomerOpen(true)}><Plus/>Cadastrar Cliente</Button></div>{clientTable(data.clients)}</>;
  const categories=<><Heading icon={Tags} title="Categorias" subtitle="Organize seus clientes por serviço ou grupo"/><Panel><form className="inline-form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await mutate('createCategory',{name:f.get('name')});e.currentTarget.reset()}catch(x){setNotice((x as Error).message)}}}><Input name="name" placeholder="Nome da categoria" required/><Button><Plus/>Criar categoria</Button></form><div className="chip-list">{data.categories.length?data.categories.map(c=><span className="category-chip" key={c.id}>{c.name}<button aria-label={'Excluir '+c.name} onClick={()=>void mutate('deleteCategory',{id:c.id})}><X/></button></span>):<p className="empty-copy">Nenhuma categoria criada ainda.</p>}</div></Panel></>;
  const search=<><Heading icon={Search} title="Busca Avançada" subtitle="Encontre clientes rapidamente com filtros"/><Panel><div className="filter-grid"><Field label="Nome, telefone ou observação"><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Digite para buscar"/></Field><Field label="Status"><select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option>Todos</option><option>Vencido</option><option>Hoje</option><option>Próximo</option><option>Em dia</option></select></Field></div></Panel>{clientTable(filtered)}</>;
  const due=<><Heading icon={CalendarDays} title="Vencimentos" subtitle="Clientes vencidos, vencendo hoje e nos próximos 7 dias"/>{clientTable([...counts.late,...counts.today,...counts.next])}</>;

  const notes=<><Heading icon={StickyNote} title="Bloco de Notas" subtitle="Notas particulares da equipe"/><Panel><form className="stack-form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await mutate('createNote',{title:f.get('title'),content:f.get('content')});e.currentTarget.reset()}catch(x){setNotice((x as Error).message)}}}><Input name="title" placeholder="Nome da nota" required/><Textarea name="content" placeholder="Escreva sua nota" required/><Button><Plus/>Criar e salvar nota</Button></form></Panel><div className="note-grid">{data.notes.length?data.notes.map(n=><Panel key={n.id}><div className="card-title-row"><h3>{n.title}</h3><Button size="icon-sm" variant="destructive" onClick={()=>void mutate('deleteNote',{id:n.id})}><Trash2/></Button></div><p className="note-content">{n.content}</p></Panel>):<Panel><p className="empty-copy">Nenhuma nota salva ainda.</p></Panel>}</div></>;

  const reportCards=[
    ['Relatório Mensal','Visão geral completa do mês',['Lista completa de clientes','Estatísticas de vencimentos','Valores totais e médios']],
    ['Relatório de Vencimentos','Análise detalhada por período',['Clientes vencidos','Vencimentos próximos','Valores em atraso']],
    ['Relatório Financeiro','Análise financeira completa',['Receitas e inadimplência','Projeções de recebimento','Gráficos financeiros']],
  ];
  const reports=<><Heading icon={FileText} title="Relatórios PDF" subtitle="Gere relatórios da sua base privada"/><div className="summary-strip"><span><strong>{data.clients.length}</strong>Total de Clientes</span><span><strong>{counts.late.length}</strong>Clientes Vencidos</span><span><strong>{money(total)}</strong>Valor Total</span><span><strong>{new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</strong>Mês Atual</span></div><div className="three-grid">{reportCards.map(([title,sub,items])=><Panel key={title as string}><div className="panel-icon"><FileText/></div><h3>{title as string}</h3><p>{sub as string}</p><ul>{(items as string[]).map(i=><li key={i}>✓ {i}</li>)}</ul><Button onClick={()=>window.print()}><FileText/>Gerar PDF</Button></Panel>)}</div></>;
  const charts=<><Heading icon={BarChart3} title="Gráficos de Evolução" subtitle="Análise temporal dos seus dados"/><section className="metric-grid compact">{[['Clientes',data.clients.length],['Valor total',money(total)],['Em dia',counts.ok.length],['Em atraso',counts.late.length]].map(([a,b])=><Panel key={a as string}><small>{a as string}</small><strong className="chart-number">{b as string|number}</strong></Panel>)}</section><Panel><h2>Distribuição por situação</h2><div className="bar-chart">{[['Vencidos',counts.late.length,'red'],['Hoje',counts.today.length,'yellow'],['Próximos',counts.next.length,'violet'],['Em dia',counts.ok.length,'green']].map(([l,n,t])=><div key={l as string}><span>{l as string}</span><i><b className={t as string} style={{width:(data.clients.length?Math.max(4,(n as number)/data.clients.length*100):0)+'%'}}/></i><strong>{n as number}</strong></div>)}</div></Panel></>;

  const settingsForm=(kind:'reminders'|'pix'|'messages')=>{
    if(kind==='reminders') return <form className="settings-grid" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void saveSettings({whatsappEnabled:f.get('whatsappEnabled')==='on',sendTime:String(f.get('sendTime')),daysBefore:String(f.get('daysBefore')),telegramEnabled:f.get('telegramEnabled')==='on'})}}><Panel><h3>📱 Configuração do WhatsApp</h3><Field label="Ativar lembretes"><Switch name="whatsappEnabled"/></Field><Field label="Horário de envio"><Input type="time" name="sendTime" defaultValue={data.settings.sendTime||'10:00'}/></Field><Field label="Dias antes do vencimento"><select name="daysBefore" defaultValue={data.settings.daysBefore||'1'}><option value="0">No dia</option><option value="1">1 dia antes</option><option value="3">3 dias antes</option><option value="7">7 dias antes</option></select></Field></Panel><Panel><h3>✈️ Configuração do Telegram</h3><Field label="Ativar lembretes"><Switch name="telegramEnabled"/></Field><p className="security-note"><ShieldCheck/>Tokens de integração só devem ser adicionados quando o backend próprio estiver configurado.</p></Panel><Button className="settings-save">Salvar configurações</Button></form>;
    if(kind==='pix') return <Panel><form className="stack-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void saveSettings({pixType:String(f.get('pixType')),pixKey:String(f.get('pixKey')),pixName:String(f.get('pixName')),pixBank:String(f.get('pixBank')),pixCity:String(f.get('pixCity'))})}}><Field label="Tipo de chave"><select name="pixType" defaultValue={data.settings.pixType||''}><option value="">Selecione</option><option>CPF</option><option>CNPJ</option><option>Telefone</option><option>E-mail</option><option>Chave aleatória</option></select></Field><Field label="Chave PIX"><Input name="pixKey" defaultValue={data.settings.pixKey||''}/></Field><Field label="Nome do recebedor"><Input name="pixName" defaultValue={data.settings.pixName||''}/></Field><Field label="Banco / instituição"><Input name="pixBank" defaultValue={data.settings.pixBank||''}/></Field><Field label="Cidade"><Input name="pixCity" defaultValue={data.settings.pixCity||''}/></Field><Button><WalletCards/>Salvar PIX</Button></form><p className="security-note"><ShieldCheck/>Os dados ficam somente nesta base privada.</p></Panel>;
    return <form className="message-grid" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void saveSettings({dueMessage:String(f.get('dueMessage')),lateMessage:String(f.get('lateMessage')),renewMessage:String(f.get('renewMessage'))})}}>{[['dueMessage','Mensagem de Vencimento'],['lateMessage','Mensagem de Vencido'],['renewMessage','Mensagem de Renovação']].map(([key,label])=><Panel key={key}><h3>{label}</h3><Textarea name={key} defaultValue={data.settings[key]||defaults[key as keyof typeof defaults]}/><small>Variáveis: {'{nome} {vencimento} {valor}'}</small></Panel>)}<Button className="settings-save">Salvar mensagens</Button></form>;
  };
  const reminders=<><Heading icon={AlarmClock} title="Gestão de Mensagens e Cobranças" subtitle="Configure horários e dias dos lembretes"/>{settingsForm('reminders')}</>;

  const exportCsv=()=>{const header=['Nome','Telefone','Categoria','Observação','Vencimento','Valor'];const lines=data.clients.map(c=>[c.name,c.phone,c.categoryName||'',c.observation,c.dueDate,c.amount.toFixed(2)].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';'));const blob=new Blob(['\uFEFF'+[header.join(';'),...lines].join('\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='clientes.csv';a.click();URL.revokeObjectURL(a.href)};
  const exportView=<><Heading icon={FileUp} title="Exportação de Dados" subtitle="Exporte seus dados sem enviá-los a outro serviço"/><div className="summary-strip"><span><strong>{data.clients.length}</strong>Total de Clientes</span><span><strong>{money(total)}</strong>Valor Total</span></div><Panel><h2>Exportar Dados</h2><p>O arquivo é gerado diretamente a partir desta base.</p><Button onClick={exportCsv}><Download/>Exportar CSV</Button></Panel></>;
  const whatsapp=<><Heading icon={MessageCircle} title="Integração WhatsApp" subtitle="Status, testes e histórico da integração"/><Tabs defaultValue="status"><TabsList className="wa-tabs"><TabsTrigger value="status">Status</TabsTrigger><TabsTrigger value="messages">Mensagens</TabsTrigger><TabsTrigger value="automation">Automação</TabsTrigger><TabsTrigger value="sent">Enviadas</TabsTrigger></TabsList><TabsContent value="status"><Panel><div className="connection-card"><span className="connection-dot"/><div><h2>WhatsApp desconectado</h2><p>Nenhum provedor externo foi configurado. Seus dados não são enviados para fora.</p></div></div><Button disabled>Conectar com backend próprio</Button></Panel></TabsContent><TabsContent value="messages"><Panel><h2>Mensagem de teste</h2><p>Disponível após configurar seu próprio conector.</p><Input placeholder="Telefone com DDD" disabled/><Textarea placeholder="Mensagem" disabled/></Panel></TabsContent><TabsContent value="automation"><Panel><h2>Automação</h2><p>Cobranças automáticas permanecem inativas até a configuração de um provedor próprio.</p><p className="security-note"><ShieldCheck/>Credenciais devem ficar somente no servidor.</p></Panel></TabsContent><TabsContent value="sent"><Panel><h2>Mensagens Enviadas</h2><p className="empty-copy">Nenhuma mensagem enviada ainda.</p></Panel></TabsContent></Tabs></>;
  const messages=<><Heading icon={MessagesSquare} title="Configuração de Mensagens" subtitle="Personalize os textos das cobranças"/>{settingsForm('messages')}</>;
  const pix=<><Heading icon={Gem} title="Configurar PIX" subtitle="Cadastre o PIX usado nas cobranças desta equipe"/>{settingsForm('pix')}</>;
  const billing=<><Heading icon={CreditCard} title="Acesso do Gestor" subtitle="Esta cópia pertence à sua equipe"/><Panel><div className="ownership-card"><ShieldCheck/><div><h2>Ambiente privado</h2><p>Sem assinatura do sistema original. O acesso é controlado pela publicação privada.</p></div></div></Panel></>;
  const profile=<><Heading icon={Settings} title="Gerenciar Perfil" subtitle="Preferências da interface"/><Panel><div className="profile-setting"><div><h3>Modo escuro</h3><p>Use a aparência mais confortável para sua equipe.</p></div><Switch checked={dark} onCheckedChange={checked=>setDark(checked)} /></div><div className="profile-setting"><div><h3>Acesso protegido</h3><p>Somente pessoas autorizadas na publicação privada poderão abrir o gestor.</p></div><ShieldCheck/></div></Panel></>;
  const viewContent:{[K in View]:React.ReactNode}={dashboard,clients,categories,search,due,notes,reports,charts,reminders,export:exportView,whatsapp,messages,pix,billing,profile};

  return <div className={dark?'theme-dark':'theme-light'}><SidebarProvider defaultOpen><Sidebar className="gestor-sidebar" collapsible="offcanvas"><SidebarHeader className="brand-block"><div className="brand-mark">AR</div><div><strong>AR GESTOR PRO</strong><span>Sistema de Gestão</span></div></SidebarHeader><SidebarContent><SidebarGroup><SidebarGroupContent><Navigation view={view} onSelect={setView}/></SidebarGroupContent></SidebarGroup></SidebarContent><SidebarFooter className="sidebar-footer"><span>Dados privados</span><strong>Ambiente da equipe</strong></SidebarFooter></Sidebar>
    <SidebarInset className="app-shell"><header className="topbar"><SidebarTrigger className="mobile-trigger"><Menu/></SidebarTrigger><div className="topbar-actions"><Button aria-label="Notificações" variant="outline" size="icon-lg" onClick={()=>setNotice(counts.late.length?counts.late.length+' cliente(s) vencido(s).':'Nenhum vencimento pendente.')}><Bell/></Button><Button variant="outline" size="lg" onClick={()=>setDark(!dark)}>{dark?<Sun/>:<Moon/>}{dark?'Claro':'Escuro'}</Button></div></header>
      {notice&&<button className="notice" onClick={()=>setNotice('')}>{notice}<X/></button>}<main className="dashboard-content">{viewContent[view]}</main>
    </SidebarInset>
    <Dialog open={customerOpen} onOpenChange={setCustomerOpen}><DialogContent className="customer-dialog"><DialogHeader><DialogTitle>Cadastrar Cliente</DialogTitle><DialogDescription>Salve os dados somente na base privada da equipe.</DialogDescription></DialogHeader><form className="stack-form" onSubmit={async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await mutate('createClient',{name:f.get('name'),phone:f.get('phone'),telegramChatId:f.get('telegramChatId'),categoryId:f.get('categoryId'),observation:f.get('observation'),dueDate:f.get('dueDate'),amount:f.get('amount')});setCustomerOpen(false);e.currentTarget.reset()}catch(x){setNotice((x as Error).message)}}}><Field label="Nome"><Input name="name" required placeholder="Nome do cliente"/></Field><Field label="Telefone com DDD"><Input name="phone" required placeholder="11999999999"/></Field><Field label="Chat ID do Telegram (opcional)"><Input name="telegramChatId"/></Field><Field label="Categoria"><select name="categoryId"><option value="">Sem categoria</option>{data.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Observação"><Textarea name="observation"/></Field><Field label="Data de vencimento"><Input type="date" name="dueDate" required/></Field><Field label="Valor (R$)"><Input type="number" name="amount" min="0" step="0.01" required/></Field><Button>Salvar Cliente</Button></form></DialogContent></Dialog>
  </SidebarProvider></div>;
}

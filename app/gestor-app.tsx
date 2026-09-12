'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlarmClock, BarChart3, Bell, Building2, CalendarDays, CheckCircle2, CircleDollarSign,
  CreditCard, Download, FileText, FileUp, Gem, KeyRound, Landmark, LayoutDashboard, LogOut, Menu,
  MessageCircle, MessagesSquare, Moon, Pencil, Plus, RefreshCw, Search, Settings,
  ShieldCheck, StickyNote, Sun, Tags, Trash2, UserPlus, Users, WalletCards, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger, useSidebar,
} from '@/components/ui/sidebar';
import WhatsAppPanel, { AutomationSettingsForm } from '@/app/whatsapp-panel';
import FinancePanel from '@/app/finance-panel';

type View = 'dashboard'|'clients'|'categories'|'search'|'due'|'notes'|'reports'|'charts'|'reminders'|'export'|'whatsapp'|'messages'|'pix'|'finance'|'billing'|'team'|'organizations'|'profile';
export type CurrentUser = { id:number; organizationId:number; organizationName:string; name:string; email:string; role:'master'|'member'; platformAdmin:boolean; financeAccess:boolean };
type TeamUser = { id:number; name:string; email:string; role:string; status:string; platformAdmin:boolean; financeAccess:boolean; createdAt:string; lastLoginAt:string|null };
type AuditEntry = { id:number; action:string; entityType:string; details:string; createdAt:string; userName:string };
type TeamData = { users:TeamUser[]; audit:AuditEntry[] };
type ActivityFilter = 'all'|'clients'|'team';
type Category = { id:number; name:string };
type Client = { id:number; name:string; phone:string; telegramChatId:string|null; categoryId:number|null; categoryName:string|null; observation:string; dueDate:string; amount:number };
type Note = { id:number; title:string; content:string; createdAt:string };
type DataState = { clients:Client[]; categories:Category[]; notes:Note[]; settings:Record<string,string> };
type Organization = { id:number; name:string; slug:string; status:string; plan:string; createdAt:string; users:number; clients:number };
type WebMcpTool = {
  name:string;
  description:string;
  inputSchema:Record<string,unknown>;
  execute:(input:Record<string,unknown>)=>unknown;
};
type WebMcpDocument = Document & {
  modelContext?: { registerTool:(tool:WebMcpTool,options?:{signal?:AbortSignal})=>Promise<void>|void };
};

const views: Array<{key:View; label:string; icon:typeof LayoutDashboard; masterOnly?:boolean; platformOnly?:boolean; financeOnly?:boolean}> = [
  {key:'dashboard',label:'Dashboard',icon:LayoutDashboard},{key:'clients',label:'Meus Clientes',icon:Users},
  {key:'categories',label:'Categorias',icon:Tags},{key:'search',label:'Busca',icon:Search},
  {key:'due',label:'Vencimentos',icon:CalendarDays},{key:'notes',label:'Bloco de Notas',icon:StickyNote},
  {key:'reports',label:'Relatórios PDF',icon:FileText},{key:'charts',label:'Gráficos',icon:BarChart3},
  {key:'reminders',label:'Dias de Cobrança',icon:AlarmClock},{key:'export',label:'Exportar',icon:FileUp},
  {key:'whatsapp',label:'Cobranças WhatsApp',icon:MessageCircle},{key:'messages',label:'Gerenciar Mensagens',icon:MessagesSquare},
  {key:'pix',label:'PIX',icon:Gem},{key:'finance',label:'Financeiro',icon:Landmark,financeOnly:true},{key:'billing',label:'Assinatura',icon:CreditCard},
  {key:'organizations',label:'Empresas',icon:Building2,platformOnly:true},
  {key:'team',label:'Equipe',icon:UserPlus,masterOnly:true},{key:'profile',label:'Perfil',icon:Settings},
];

const emptyData:DataState={clients:[],categories:[],notes:[],settings:{}};
const defaults={
  dueMessage:'Olá {nome}, lembramos que sua cobrança vence em {vencimento}, no valor de {valor}.\n\nPIX: {pix_chave}\nRecebedor: {pix_recebedor}\nBanco: {pix_banco}\nConta: {pix_conta}',
  lateMessage:'Olá {nome}, sua cobrança venceu em {vencimento}, no valor de {valor}.\n\nPIX: {pix_chave}\nRecebedor: {pix_recebedor}\nBanco: {pix_banco}\nConta: {pix_conta}',
  renewMessage:'Olá {nome}, sua renovação foi registrada. Novo vencimento: {vencimento}. Valor: {valor}.\n\nPIX: {pix_chave}\nRecebedor: {pix_recebedor}',
};
const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
const today=()=>new Date().toISOString().slice(0,10);
const diffDays=(date:string)=>Math.ceil((new Date(date+'T12:00:00').getTime()-new Date(today()+'T12:00:00').getTime())/86400000);
const statusOf=(date:string)=>diffDays(date)<0?'Vencido':diffDays(date)===0?'Hoje':diffDays(date)<=7?'Próximo':'Em dia';
const activityLabels:Record<string,string>={
  login:'Entrou no sistema',logout:'Saiu do sistema',change_password:'Alterou a própria senha',
  create_user:'Cadastrou colaborador',set_user_status:'Alterou o status do colaborador',
  set_user_role:'Alterou a permissão do colaborador',reset_user_password:'Redefiniu a senha do colaborador',
  set_finance_access:'Alterou o acesso ao financeiro',create_financial_transaction:'Criou lançamento financeiro',
  update_financial_transaction:'Editou lançamento financeiro',delete_financial_transaction:'Excluiu lançamento financeiro',
  create_client:'Cadastrou cliente',update_client:'Editou cliente',delete_client:'Excluiu cliente',renew_client:'Renovou cliente',
  create_category:'Criou categoria',delete_category:'Excluiu categoria',create_note:'Criou nota',delete_note:'Excluiu nota',save_settings:'Salvou configurações',
  create_organization:'Criou empresa',set_organization_status:'Alterou status da empresa',set_organization_plan:'Alterou plano da empresa',
  save_whatsapp_connection:'Configurou WhatsApp',test_whatsapp_connection:'Testou conexão do WhatsApp',remove_whatsapp_connection:'Removeu conexão do WhatsApp',
  send_whatsapp:'Enviou cobrança pelo WhatsApp',send_whatsapp_test:'Enviou teste pelo WhatsApp',run_whatsapp_automation:'Executou automação de cobranças',
};

function Heading({icon:Icon,title,subtitle}:{icon:typeof LayoutDashboard;title:string;subtitle:string}) {
  return <div className="page-heading"><div className="page-icon"><Icon/></div><h1>{title}</h1><p>{subtitle}</p></div>;
}
function Panel({children,className=''}:{children:React.ReactNode;className?:string}) {
  return <Card className={'content-card '+className}><CardContent>{children}</CardContent></Card>;
}
function Field({label,children}:{label:string;children:React.ReactNode}) {
  return <label className="field-label"><span>{label}</span>{children}</label>;
}
function Navigation({view,onSelect,currentUser}:{view:View;onSelect:(key:View)=>void;currentUser:CurrentUser}) {
  const {isMobile,setOpenMobile}=useSidebar();
  const select=(key:View)=>{
    onSelect(key);
    if(isMobile) setOpenMobile(false);
  };
  return <SidebarMenu className="nav-menu">{views.filter(item=>(!item.masterOnly||currentUser.role==='master')&&(!item.platformOnly||currentUser.platformAdmin)&&(!item.financeOnly||currentUser.platformAdmin||currentUser.financeAccess)).map(({key,label,icon:Icon})=><SidebarMenuItem key={key}><SidebarMenuButton isActive={view===key} tooltip={label} onClick={()=>select(key)}><Icon/><span>{label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu>;
}

export default function GestorApp({currentUser,onLogout}:{currentUser:CurrentUser;onLogout:()=>void}) {
  const [view,setView]=useState<View>('dashboard');
  const [data,setData]=useState<DataState>(emptyData);
  const [customerOpen,setCustomerOpen]=useState(false);
  const [editingClient,setEditingClient]=useState<Client|null>(null);
  const [notice,setNotice]=useState('');
  const [dark,setDark]=useState(true);
  const [query,setQuery]=useState('');
  const [filterStatus,setFilterStatus]=useState('Todos');
  const [team,setTeam]=useState<TeamData>({users:[],audit:[]});
  const [activityFilter,setActivityFilter]=useState<ActivityFilter>('all');
  const [organizations,setOrganizations]=useState<Organization[]>([]);
  const openNewClient=()=>{setEditingClient(null);setCustomerOpen(true)};
  const openEditClient=(client:Client)=>{setEditingClient(client);setCustomerOpen(true)};

  const load=async()=>{
    try {
      const response=await fetch('/api/data',{cache:'no-store'});
      if(response.status===401){onLogout();return}
      if(!response.ok) throw new Error();
      setData(await response.json() as DataState);
    } catch { setNotice('Não foi possível carregar os dados agora.'); }
  };
  useEffect(()=>{void load()},[]);
  const mutate=async(action:string,payload:Record<string,unknown>)=>{
    const response=await fetch('/api/data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...payload})});
    const result=await response.json() as {error?:string};
    if(!response.ok) throw new Error(result.error||'Não foi possível salvar.');
    await load();
  };
  const loadTeam=async()=>{
    if(currentUser.role!=='master') return;
    const response=await fetch('/api/users',{cache:'no-store'});
    const result=await response.json() as TeamData&{error?:string};
    if(!response.ok) throw new Error(result.error||'Não foi possível carregar a equipe.');
    setTeam(result);
  };
  const manageUser=async(action:string,payload:Record<string,unknown>)=>{
    const response=await fetch('/api/users',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...payload})});
    const result=await response.json() as {error?:string};
    if(!response.ok) throw new Error(result.error||'Não foi possível atualizar a equipe.');
    await loadTeam();
  };
  const loadOrganizations=async()=>{
    if(!currentUser.platformAdmin) return;
    const response=await fetch('/api/organizations',{cache:'no-store'});
    const result=await response.json() as {organizations?:Organization[];error?:string};
    if(!response.ok) throw new Error(result.error||'Não foi possível carregar as empresas.');
    setOrganizations(result.organizations||[]);
  };
  const manageOrganization=async(action:string,payload:Record<string,unknown>)=>{
    const response=await fetch('/api/organizations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...payload})});
    const result=await response.json() as {error?:string};
    if(!response.ok) throw new Error(result.error||'Não foi possível atualizar a empresa.');
    await loadOrganizations();
  };
  useEffect(()=>{if(view==='team')void loadTeam().catch(error=>setNotice((error as Error).message))},[view]);
  useEffect(()=>{if(view==='organizations')void loadOrganizations().catch(error=>setNotice((error as Error).message))},[view]);
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
  const filteredAudit=team.audit.filter(entry=>activityFilter==='all'||(activityFilter==='clients'&&entry.entityType==='client')||(activityFilter==='team'&&(entry.entityType==='user'||entry.entityType==='session')));
  const saveSettings=async(values:Record<string,string|boolean>)=>{try{await mutate('saveSettings',{values});setNotice('Configurações salvas.')}catch(e){setNotice((e as Error).message)}};
  const renderChargeMessage=(client:Client,kind:'due'|'late'|'renew'=diffDays(client.dueDate)<0?'late':'due')=>{
    const messageKey=kind==='due'?'dueMessage':kind==='late'?'lateMessage':'renewMessage';
    const replacements:Record<string,string>={
      nome:client.name,
      empresa:currentUser.organizationName,
      vencimento:new Date(client.dueDate+'T12:00:00').toLocaleDateString('pt-BR'),
      valor:money(client.amount),
      pix_chave:data.settings.pixKey||'não informado',
      pix_tipo:data.settings.pixType||'',
      pix_recebedor:data.settings.pixName||'não informado',
      pix_banco:data.settings.pixBank||'',
      pix_conta:data.settings.pixAccount||'',
    };
    let message=data.settings[messageKey]||defaults[messageKey];
    if(data.settings.includePix==='false') message=message.split('\n').filter(line=>!/\{pix_(chave|tipo|recebedor|banco|conta)\}/.test(line)).join('\n');
    for(const [key,value] of Object.entries(replacements)) message=message.replaceAll(`{${key}}`,value);
    return message.split('\n').filter(line=>!/^\s*(PIX|Recebedor|Banco|Conta):\s*$/.test(line)).join('\n').replace(/\n{3,}/g,'\n\n').trim();
  };
  const openAssistedWhatsapp=(client:Client,kind:'due'|'late'|'renew'=diffDays(client.dueDate)<0?'late':'due')=>{
    let phone=client.phone.replace(/\D/g,'').replace(/^0+/, '');
    if(phone.length===10||phone.length===11) phone='55'+phone;
    if(phone.length<12||phone.length>15){setNotice(`Revise o telefone de ${client.name}. Informe DDD e número.`);return}
    const url=`https://wa.me/${phone}?text=${encodeURIComponent(renderChargeMessage(client,kind))}`;
    const popup=window.open(url,'_blank');
    if(popup) popup.opener=null; else window.location.assign(url);
    setNotice(`Cobrança de ${client.name} preparada. Confirme o envio no WhatsApp.`);
  };
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
    <div className="quick-actions"><Button onClick={()=>{setView('clients');openNewClient()}}><Plus/>Adicionar Cliente</Button><Button variant="outline" onClick={()=>setView('due')}><CalendarDays/>Vencimentos</Button><Button variant="outline" onClick={()=>setView('whatsapp')}><MessageCircle/>Cobrar pelo WhatsApp</Button></div>
  </>;

  const clientTable=(rows:Client[])=><Panel><Table className="responsive-table"><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead>Categoria</TableHead><TableHead>Vencimento</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
    <TableBody>{rows.length?rows.map(c=><TableRow key={c.id}><TableCell data-label="Nome"><strong>{c.name}</strong><small className="client-observation-preview" title={c.observation||'Sem observações'}>{c.observation||'Sem observações'}</small></TableCell><TableCell data-label="Telefone">{c.phone}</TableCell><TableCell data-label="Categoria">{c.categoryName||'Sem categoria'}</TableCell><TableCell data-label="Vencimento">{new Date(c.dueDate+'T12:00:00').toLocaleDateString('pt-BR')}</TableCell><TableCell data-label="Valor">{money(c.amount)}</TableCell><TableCell data-label="Status"><span className={'status status-'+statusOf(c.dueDate).toLowerCase().replace('ó','o').replaceAll(' ','-')}>{statusOf(c.dueDate)}</span></TableCell><TableCell data-label="Ações"><div className="row-actions"><Button size="sm" variant="outline" onClick={()=>openEditClient(c)}><Pencil/>Editar</Button><Button size="sm" variant="outline" onClick={()=>{if(confirm(`Confirmar o recebimento de ${money(c.amount)} de ${c.name} e renovar por mais um mês?`))void mutate('renewClient',{id:c.id,dueDate:c.dueDate}).then(()=>setNotice('Recebimento registrado e cliente renovado.')).catch(error=>setNotice((error as Error).message))}}><RefreshCw/>Receber e renovar</Button><Button size="sm" variant="outline" onClick={()=>openAssistedWhatsapp(c)}><MessageCircle/>Preparar cobrança</Button><Button aria-label={'Excluir '+c.name} size="icon-sm" variant="destructive" onClick={()=>{if(confirm('Excluir este cliente?'))void mutate('deleteClient',{id:c.id})}}><Trash2/></Button></div></TableCell></TableRow>):<TableRow><TableCell colSpan={7} className="empty-cell">Nenhum cliente cadastrado ainda.</TableCell></TableRow>}</TableBody>
  </Table></Panel>;

  const clients=<><Heading icon={Users} title="Meus Clientes" subtitle="Clientes cadastrados nesta base privada"/><div className="section-toolbar"><span>{data.clients.length} cliente(s)</span><Button onClick={openNewClient}><Plus/>Cadastrar Cliente</Button></div>{clientTable(data.clients)}</>;
  const categories=<><Heading icon={Tags} title="Categorias" subtitle="Organize seus clientes por serviço ou grupo"/><Panel><form className="inline-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);try{await mutate('createCategory',{name:f.get('name')});form.reset()}catch(x){setNotice((x as Error).message)}}}><Input name="name" placeholder="Nome da categoria" required/><Button type="submit"><Plus/>Criar categoria</Button></form><div className="chip-list">{data.categories.length?data.categories.map(c=><span className="category-chip" key={c.id}>{c.name}<button aria-label={'Excluir '+c.name} onClick={()=>void mutate('deleteCategory',{id:c.id})}><X/></button></span>):<p className="empty-copy">Nenhuma categoria criada ainda.</p>}</div></Panel></>;
  const search=<><Heading icon={Search} title="Busca Avançada" subtitle="Encontre clientes rapidamente com filtros"/><Panel><div className="filter-grid"><Field label="Nome, telefone ou observação"><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Digite para buscar"/></Field><Field label="Status"><select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option>Todos</option><option>Vencido</option><option>Hoje</option><option>Próximo</option><option>Em dia</option></select></Field></div></Panel>{clientTable(filtered)}</>;
  const due=<><Heading icon={CalendarDays} title="Vencimentos" subtitle="Clientes vencidos, vencendo hoje e nos próximos 7 dias"/>{clientTable([...counts.late,...counts.today,...counts.next])}</>;

  const notes=<><Heading icon={StickyNote} title="Bloco de Notas" subtitle="Notas particulares da equipe"/><Panel><form className="stack-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);try{await mutate('createNote',{title:f.get('title'),content:f.get('content')});form.reset()}catch(x){setNotice((x as Error).message)}}}><Input name="title" placeholder="Nome da nota" required/><Textarea name="content" placeholder="Escreva sua nota" required/><Button type="submit"><Plus/>Criar e salvar nota</Button></form></Panel><div className="note-grid">{data.notes.length?data.notes.map(n=><Panel key={n.id}><div className="card-title-row"><h3>{n.title}</h3><Button size="icon-sm" variant="destructive" onClick={()=>void mutate('deleteNote',{id:n.id})}><Trash2/></Button></div><p className="note-content">{n.content}</p></Panel>):<Panel><p className="empty-copy">Nenhuma nota salva ainda.</p></Panel>}</div></>;

  const reportCards=[
    ['Relatório Mensal','Visão geral completa do mês',['Lista completa de clientes','Estatísticas de vencimentos','Valores totais e médios']],
    ['Relatório de Vencimentos','Análise detalhada por período',['Clientes vencidos','Vencimentos próximos','Valores em atraso']],
    ['Relatório Financeiro','Análise financeira completa',['Receitas e inadimplência','Projeções de recebimento','Gráficos financeiros']],
  ];
  const reports=<><Heading icon={FileText} title="Relatórios PDF" subtitle="Gere relatórios da sua base privada"/><div className="summary-strip"><span><strong>{data.clients.length}</strong>Total de Clientes</span><span><strong>{counts.late.length}</strong>Clientes Vencidos</span><span><strong>{money(total)}</strong>Valor Total</span><span><strong>{new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</strong>Mês Atual</span></div><div className="three-grid">{reportCards.map(([title,sub,items])=><Panel key={title as string}><div className="panel-icon"><FileText/></div><h3>{title as string}</h3><p>{sub as string}</p><ul>{(items as string[]).map(i=><li key={i}>✓ {i}</li>)}</ul><Button onClick={()=>window.print()}><FileText/>Gerar PDF</Button></Panel>)}</div></>;
  const charts=<><Heading icon={BarChart3} title="Gráficos de Evolução" subtitle="Análise temporal dos seus dados"/><section className="metric-grid compact">{[['Clientes',data.clients.length],['Valor total',money(total)],['Em dia',counts.ok.length],['Em atraso',counts.late.length]].map(([a,b])=><Panel key={a as string}><small>{a as string}</small><strong className="chart-number">{b as string|number}</strong></Panel>)}</section><Panel><h2>Distribuição por situação</h2><div className="bar-chart">{[['Vencidos',counts.late.length,'red'],['Hoje',counts.today.length,'yellow'],['Próximos',counts.next.length,'violet'],['Em dia',counts.ok.length,'green']].map(([l,n,t])=><div key={l as string}><span>{l as string}</span><i><b className={t as string} style={{width:(data.clients.length?Math.max(4,(n as number)/data.clients.length*100):0)+'%'}}/></i><strong>{n as number}</strong></div>)}</div></Panel></>;

  const settingsForm=(kind:'pix'|'messages')=>{
    if(kind==='pix') return <Panel><form key={'pix-'+data.settings.pixKey} className="stack-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void saveSettings({pixType:String(f.get('pixType')),pixKey:String(f.get('pixKey')),pixName:String(f.get('pixName')),pixBank:String(f.get('pixBank')),pixAccount:String(f.get('pixAccount')),pixCity:String(f.get('pixCity'))})}}><Field label="Tipo de chave"><select name="pixType" defaultValue={data.settings.pixType||''}><option value="">Selecione</option><option>CPF</option><option>CNPJ</option><option>Telefone</option><option>E-mail</option><option>Chave aleatória</option></select></Field><Field label="Chave PIX"><Input name="pixKey" defaultValue={data.settings.pixKey||''}/></Field><Field label="Nome do recebedor"><Input name="pixName" defaultValue={data.settings.pixName||''}/></Field><Field label="Banco / instituição"><Input name="pixBank" defaultValue={data.settings.pixBank||''}/></Field><Field label="Agência e conta (opcional)"><Input name="pixAccount" defaultValue={data.settings.pixAccount||''}/></Field><Field label="Cidade"><Input name="pixCity" defaultValue={data.settings.pixCity||''}/></Field><Button type="submit"><WalletCards/>Salvar PIX</Button></form><p className="security-note"><ShieldCheck/>Estes dados pertencem somente à empresa {currentUser.organizationName} e podem ser inseridos automaticamente nas mensagens.</p></Panel>;
    return <form key={'messages-'+data.settings.dueMessage} className="message-grid" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void saveSettings({dueMessage:String(f.get('dueMessage')),lateMessage:String(f.get('lateMessage')),renewMessage:String(f.get('renewMessage'))})}}>{[['dueMessage','Mensagem de Vencimento'],['lateMessage','Mensagem de Vencido'],['renewMessage','Mensagem de Renovação']].map(([key,label])=><Panel key={key}><h3>{label}</h3><Textarea name={key} defaultValue={data.settings[key]||defaults[key as keyof typeof defaults]}/><small>Variáveis: {'{nome} {empresa} {vencimento} {valor} {pix_chave} {pix_tipo} {pix_recebedor} {pix_banco} {pix_conta}'}</small></Panel>)}<Button type="submit" className="settings-save">Salvar mensagens</Button></form>;
  };
  const reminders=<><Heading icon={AlarmClock} title="Dias de Cobrança" subtitle="Escolha os dias e horários das cobranças automáticas"/><AutomationSettingsForm settings={data.settings} onSave={saveSettings} onNotice={setNotice}/></>;

  const exportCsv=()=>{const header=['Nome','Telefone','Categoria','Observação','Vencimento','Valor'];const lines=data.clients.map(c=>[c.name,c.phone,c.categoryName||'',c.observation,c.dueDate,c.amount.toFixed(2)].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';'));const blob=new Blob(['\uFEFF'+[header.join(';'),...lines].join('\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='clientes.csv';a.click();URL.revokeObjectURL(a.href)};
  const exportView=<><Heading icon={FileUp} title="Exportação de Dados" subtitle="Exporte seus dados sem enviá-los a outro serviço"/><div className="summary-strip"><span><strong>{data.clients.length}</strong>Total de Clientes</span><span><strong>{money(total)}</strong>Valor Total</span></div><Panel><h2>Exportar Dados</h2><p>O arquivo é gerado diretamente a partir desta base.</p><Button onClick={exportCsv}><Download/>Exportar CSV</Button></Panel></>;
  const whatsapp=<WhatsAppPanel organizationName={currentUser.organizationName} isMaster={currentUser.role==='master'} clients={data.clients} settings={data.settings} onSave={saveSettings} onNotice={setNotice} onAssisted={openAssistedWhatsapp} onOpenMessages={()=>setView('messages')} onOpenPix={()=>setView('pix')}/>;
  const messages=<><Heading icon={MessagesSquare} title="Configuração de Mensagens" subtitle="Personalize os textos das cobranças"/>{settingsForm('messages')}</>;
  const pix=<><Heading icon={Gem} title="Configurar PIX" subtitle="Cadastre o PIX usado nas cobranças desta equipe"/>{settingsForm('pix')}</>;
  const finance=(currentUser.platformAdmin||currentUser.financeAccess)?<FinancePanel onNotice={setNotice}/>:null;
  const billing=<><Heading icon={CreditCard} title="Acesso do Gestor" subtitle={`Ambiente de ${currentUser.organizationName}`}/><Panel><div className="ownership-card"><ShieldCheck/><div><h2>Dados separados por empresa</h2><p>Usuários desta empresa compartilham os mesmos clientes. Outras empresas não conseguem acessar estes dados.</p></div></div></Panel></>;
  const organizationsView=<><Heading icon={Building2} title="Empresas" subtitle="Crie ambientes separados para novos clientes do AR Gestor Pro"/><div className="team-grid"><Panel><h2>Nova empresa</h2><p>Ao criar, o responsável recebe uma conta Master para administrar seus próprios colaboradores.</p><form className="stack-form" onSubmit={e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);void manageOrganization('createOrganization',{name:f.get('name'),masterName:f.get('masterName'),masterEmail:f.get('masterEmail'),password:f.get('password')}).then(()=>{form.reset();setNotice('Empresa e acesso Master criados com sucesso.')}).catch(error=>setNotice((error as Error).message))}}><Field label="Nome da empresa"><Input name="name" required minLength={2}/></Field><Field label="Nome do responsável"><Input name="masterName" required minLength={2}/></Field><Field label="E-mail do Master"><Input name="masterEmail" type="email" required/></Field><Field label="Senha temporária"><Input name="password" type="password" required minLength={10}/></Field><Button type="submit"><Building2/>Criar empresa e acesso</Button></form></Panel><Panel><h2>Como funciona</h2><div className="team-explainer"><ShieldCheck/><p>Cada empresa possui clientes, equipe, PIX, mensagens e WhatsApp separados.</p></div><div className="team-explainer"><Users/><p>O Master da empresa cria colaboradores que enxergam somente o ambiente daquela empresa.</p></div></Panel></div><Panel><div className="section-toolbar"><span>{organizations.length} empresa(s)</span><Button variant="outline" onClick={()=>void loadOrganizations()}><RefreshCw/>Atualizar</Button></div><Table className="responsive-table"><TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Plano</TableHead><TableHead>Usuários</TableHead><TableHead>Clientes</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{organizations.map(org=><TableRow key={org.id}><TableCell data-label="Empresa"><strong>{org.name}</strong><small>{org.slug}</small></TableCell><TableCell data-label="Plano"><select value={org.plan} onChange={e=>void manageOrganization('setOrganizationPlan',{id:org.id,plan:e.target.value}).catch(error=>setNotice((error as Error).message))}><option value="standard">Padrão</option><option value="pro">Pro</option><option value="internal">Interno</option></select></TableCell><TableCell data-label="Usuários">{org.users}</TableCell><TableCell data-label="Clientes">{org.clients}</TableCell><TableCell data-label="Status"><span className={'status '+(org.status==='active'?'status-em-dia':'status-vencido')}>{org.status==='active'?'Ativa':'Bloqueada'}</span></TableCell><TableCell data-label="Ações"><Button size="sm" variant="outline" disabled={org.id===currentUser.organizationId} onClick={()=>void manageOrganization('setOrganizationStatus',{id:org.id,status:org.status==='active'?'blocked':'active'}).catch(error=>setNotice((error as Error).message))}>{org.status==='active'?'Bloquear':'Ativar'}</Button></TableCell></TableRow>)}</TableBody></Table></Panel></>;
  const teamView=<><Heading icon={UserPlus} title="Equipe" subtitle="Contas individuais com acesso aos mesmos dados"/>
    <div className="team-grid"><Panel><h2>Cadastrar pessoa</h2><p>Crie uma senha temporária e envie diretamente ao colega.</p><form className="stack-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);try{await manageUser('createUser',{name:f.get('name'),email:f.get('email'),password:f.get('password'),role:f.get('role')});form.reset();setNotice('Conta criada com sucesso.')}catch(error){setNotice((error as Error).message)}}}><Field label="Nome"><Input name="name" required minLength={2}/></Field><Field label="E-mail"><Input name="email" type="email" required/></Field><Field label="Senha temporária"><Input name="password" type="password" required minLength={10}/></Field><Field label="Permissão"><select name="role" defaultValue="member"><option value="member">Colaborador</option><option value="master">Master</option></select></Field><Button type="submit"><UserPlus/>Criar conta</Button></form></Panel>
    <Panel><h2>Como funciona</h2><div className="team-explainer"><ShieldCheck/><p><strong>Master</strong> acessa tudo e administra a equipe.</p></div><div className="team-explainer"><Users/><p><strong>Colaborador</strong> acessa clientes, notas, cobranças e configurações compartilhadas.</p></div><p>As ações ficam registradas para você saber quem alterou cada item.</p></Panel></div>
    <Panel><div className="section-toolbar"><span>{team.users.length} conta(s)</span><Button variant="outline" onClick={()=>void loadTeam()}><RefreshCw/>Atualizar</Button></div><Table className="responsive-table"><TableHeader><TableRow><TableHead>Pessoa</TableHead><TableHead>Permissão</TableHead><TableHead>Status</TableHead><TableHead>Financeiro</TableHead><TableHead>Último acesso</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{team.users.map(person=><TableRow key={person.id}><TableCell data-label="Pessoa"><strong>{person.name}</strong><small>{person.email}</small></TableCell><TableCell data-label="Permissão"><span className="role-pill">{person.role==='master'?'Master':'Colaborador'}</span></TableCell><TableCell data-label="Status"><span className={'status '+(person.status==='active'?'status-em-dia':'status-vencido')}>{person.status==='active'?'Ativo':'Bloqueado'}</span></TableCell><TableCell data-label="Financeiro"><span className={'status '+((person.financeAccess||person.platformAdmin)?'status-em-dia':'status-vencido')}>{person.financeAccess||person.platformAdmin?'Liberado':'Sem acesso'}</span></TableCell><TableCell data-label="Último acesso">{person.lastLoginAt?new Date(person.lastLoginAt).toLocaleString('pt-BR'):'Nunca entrou'}</TableCell><TableCell data-label="Ações"><div className="team-actions"><Button size="sm" variant="outline" disabled={person.id===currentUser.id} onClick={()=>void manageUser('setRole',{id:person.id,role:person.role==='master'?'member':'master'}).catch(error=>setNotice((error as Error).message))}>{person.role==='master'?'Tornar colaborador':'Tornar Master'}</Button><Button size="sm" variant="outline" disabled={person.id===currentUser.id} onClick={()=>void manageUser('setStatus',{id:person.id,status:person.status==='active'?'blocked':'active'}).catch(error=>setNotice((error as Error).message))}>{person.status==='active'?'Bloquear':'Ativar'}</Button>{currentUser.platformAdmin&&!person.platformAdmin&&<Button size="sm" variant="outline" disabled={person.id===currentUser.id} onClick={()=>void manageUser('setFinanceAccess',{id:person.id,financeAccess:!person.financeAccess}).then(()=>setNotice(person.financeAccess?'Acesso financeiro removido.':'Acesso financeiro liberado.')).catch(error=>setNotice((error as Error).message))}>{person.financeAccess?'Retirar financeiro':'Liberar financeiro'}</Button>}<Button size="sm" variant="outline" onClick={()=>{const password=prompt('Digite a nova senha temporária (mínimo 10 caracteres):');if(password)void manageUser('resetPassword',{id:person.id,password}).then(()=>setNotice('Senha redefinida.')).catch(error=>setNotice((error as Error).message))}}><KeyRound/>Nova senha</Button></div></TableCell></TableRow>)}</TableBody></Table></Panel>
    <Panel><div className="activity-heading"><div><h2>Atividade recente</h2><p>Acompanhe separadamente as alterações em clientes e colaboradores.</p></div><div className="activity-filters" role="group" aria-label="Filtrar atividades"><Button className={activityFilter==='all'?'activity-filter-active':''} size="sm" variant={activityFilter==='all'?'default':'outline'} onClick={()=>setActivityFilter('all')}>Ver todas <span>{team.audit.length}</span></Button><Button className={activityFilter==='clients'?'activity-filter-active':''} size="sm" variant={activityFilter==='clients'?'default':'outline'} onClick={()=>setActivityFilter('clients')}>Clientes <span>{team.audit.filter(entry=>entry.entityType==='client').length}</span></Button><Button className={activityFilter==='team'?'activity-filter-active':''} size="sm" variant={activityFilter==='team'?'default':'outline'} onClick={()=>setActivityFilter('team')}>Colaboradores <span>{team.audit.filter(entry=>entry.entityType==='user'||entry.entityType==='session').length}</span></Button></div></div><div className="audit-list">{filteredAudit.length?filteredAudit.map(entry=><div key={entry.id}><strong>{entry.userName}</strong><span>{activityLabels[entry.action]??entry.action.replaceAll('_',' ')}{entry.details?' · '+entry.details:''}</span><time>{new Date(entry.createdAt).toLocaleString('pt-BR')}</time></div>):<p className="empty-copy">Nenhuma atividade nesta categoria.</p>}</div></Panel>
  </>;
  const profile=<><Heading icon={Settings} title="Gerenciar Perfil" subtitle="Sua conta e preferências"/><div className="team-grid"><Panel><h2>{currentUser.name}</h2><p>{currentUser.email}</p><span className="role-pill">{currentUser.role==='master'?'Master':'Colaborador'}</span><div className="profile-setting"><div><h3>Modo escuro</h3><p>Use a aparência mais confortável.</p></div><Switch checked={dark} onCheckedChange={checked=>setDark(checked)} /></div></Panel><Panel><h2>Alterar senha</h2><form className="stack-form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const response=await fetch('/api/auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'changePassword',currentPassword:f.get('currentPassword'),newPassword:f.get('newPassword')})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||'Não foi possível alterar a senha.');alert('Senha alterada. Entre novamente com a nova senha.');onLogout()}catch(error){setNotice((error as Error).message)}}}><Field label="Senha atual"><Input name="currentPassword" type="password" required/></Field><Field label="Nova senha"><Input name="newPassword" type="password" minLength={10} required/></Field><Button type="submit"><KeyRound/>Alterar senha</Button></form></Panel></div></>;
  const viewContent:{[K in View]:React.ReactNode}={dashboard,clients,categories,search,due,notes,reports,charts,reminders,export:exportView,whatsapp,messages,pix,finance,billing,team:teamView,organizations:organizationsView,profile};

  return <div className={dark?'theme-dark':'theme-light'}><SidebarProvider defaultOpen><Sidebar className="gestor-sidebar" collapsible="offcanvas"><SidebarHeader className="brand-block"><div className="brand-mark">AR</div><div><strong>AR GESTOR PRO</strong><span>{currentUser.organizationName}</span></div></SidebarHeader><SidebarContent><SidebarGroup><SidebarGroupContent><Navigation view={view} onSelect={setView} currentUser={currentUser}/></SidebarGroupContent></SidebarGroup></SidebarContent><SidebarFooter className="sidebar-footer"><span>{currentUser.organizationName}</span><strong>{currentUser.name}</strong></SidebarFooter></Sidebar>
    <SidebarInset className="app-shell"><header className="topbar"><SidebarTrigger className="mobile-trigger"><Menu/></SidebarTrigger><div className="topbar-actions"><button className="user-chip" onClick={()=>setView('profile')}><span>{currentUser.name.slice(0,1).toUpperCase()}</span><div><strong>{currentUser.name}</strong><small>{currentUser.role==='master'?'Master':'Colaborador'}</small></div></button><Button aria-label="Notificações" variant="outline" size="icon-lg" onClick={()=>setNotice(counts.late.length?counts.late.length+' cliente(s) vencido(s).':'Nenhum vencimento pendente.')}><Bell/></Button><Button variant="outline" size="lg" onClick={()=>setDark(!dark)}>{dark?<Sun/>:<Moon/>}{dark?'Claro':'Escuro'}</Button><Button variant="outline" size="lg" onClick={onLogout}><LogOut/>Sair</Button></div></header>
      {notice&&<button className="notice" onClick={()=>setNotice('')}>{notice}<X/></button>}<main className="dashboard-content">{viewContent[view]}</main>
    </SidebarInset>
    <Dialog open={customerOpen} onOpenChange={open=>{setCustomerOpen(open);if(!open)setEditingClient(null)}}><DialogContent className="customer-dialog"><DialogHeader><DialogTitle>{editingClient?'Editar Cliente':'Cadastrar Cliente'}</DialogTitle><DialogDescription>{editingClient?'Atualize os dados do cliente e salve as alterações.':'Salve os dados somente na base privada da equipe.'}</DialogDescription></DialogHeader><form key={editingClient?.id??'new'} className="stack-form" onSubmit={async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);try{await mutate(editingClient?'updateClient':'createClient',{id:editingClient?.id,name:f.get('name'),phone:f.get('phone'),telegramChatId:f.get('telegramChatId'),categoryId:f.get('categoryId'),observation:f.get('observation'),dueDate:f.get('dueDate'),amount:f.get('amount')});form.reset();setCustomerOpen(false);setEditingClient(null);setNotice(editingClient?'Cliente atualizado com sucesso.':'Cliente cadastrado com sucesso.')}catch(x){setNotice((x as Error).message)}}}><Field label="Nome"><Input name="name" required placeholder="Nome do cliente" defaultValue={editingClient?.name??''}/></Field><Field label="Telefone com DDD"><Input name="phone" required placeholder="11999999999" defaultValue={editingClient?.phone??''}/></Field><Field label="Chat ID do Telegram (opcional)"><Input name="telegramChatId" defaultValue={editingClient?.telegramChatId??''}/></Field><Field label="Categoria"><select name="categoryId" defaultValue={editingClient?.categoryId??''}><option value="">Sem categoria</option>{data.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Observações do cliente"><Textarea className="client-notes" name="observation" rows={5} placeholder="Digite qualquer informação útil sobre o cliente, atendimento, preferências ou pendências..." defaultValue={editingClient?.observation??''}/></Field><Field label="Data de vencimento"><Input type="date" name="dueDate" required defaultValue={editingClient?.dueDate??''}/></Field><Field label="Valor (R$)"><Input type="number" name="amount" min="0" step="0.01" required defaultValue={editingClient?.amount??''}/></Field><Button type="submit"><Pencil/>{editingClient?'Salvar alterações':'Salvar Cliente'}</Button></form></DialogContent></Dialog>
  </SidebarProvider></div>;
}

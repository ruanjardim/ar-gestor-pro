'use client';

import { type SyntheticEvent, useCallback, useEffect, useState } from 'react';
import {
  ArrowDownCircle, ArrowUpCircle, BriefcaseBusiness, CheckCircle2, Clock3,
  Landmark, Pencil, Plus, RefreshCw, Scale, ShieldCheck, Trash2, TrendingUp, WalletCards,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { saoPauloDateKey } from '@/lib/business-date';

type FinanceScope = 'day' | 'month' | 'year';
type TransactionType = 'income' | 'expense' | 'investment';
type TransactionStatus = 'realized' | 'planned';
type Totals = Record<TransactionType, number>;
type Client = { id:number; name:string; amount:number; dueDate:string };
type Transaction = {
  id:number; clientId:number|null; clientName:string|null; createdByName:string|null;
  type:TransactionType; category:string; description:string; amount:number;
  transactionDate:string; status:TransactionStatus; settledDate:string|null; source:string; createdAt:string;
};
type Account = {
  id:string; transactionId?:number; source:string; type?:TransactionType; clientId?:number|null;
  clientName?:string|null; description:string; dueDate:string; amount:number; overdue:boolean;
};
type FinanceData = {
  scope:FinanceScope; period:string; start:string; next:string;
  transactions:Transaction[]; clients:Client[];
  accounts:{receivable:Account[];payable:Account[]};
  summary:{
    ledger:Totals; realized:Totals; planned:Totals;
    currentBalance:number; receivable:number; payable:number; projectedBalance:number;
    overdueReceivable:number; overduePayable:number;
  };
};

const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
const displayDate=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');
const today=()=>saoPauloDateKey();
const initialPeriod=(scope:FinanceScope)=>scope==='day'?today():scope==='year'?today().slice(0,4):today().slice(0,7);
const typeLabel:Record<TransactionType,string>={income:'Receita',expense:'Despesa',investment:'Investimento'};
const sourceLabel:Record<string,string>={
  client_initial_payment:'Primeira mensalidade lançada no cadastro',
  client_payment:'Gerado ao receber e renovar',
  balance_adjustment:'Ajuste auditado de conciliação',
  manual:'Lançamento manual',
};
const categories:Record<TransactionType,string[]>={
  income:['Mensalidade de cliente','Venda','Serviço avulso','Outras receitas'],
  expense:['Hospedagem e sistemas','Marketing','Impostos e taxas','Prestadores','Escritório','Transporte','Outras despesas'],
  investment:['Equipamentos','Desenvolvimento','Capacitação','Marketing de crescimento','Outros investimentos'],
};
const blankTotals=():Totals=>({income:0,expense:0,investment:0});
const emptyData=(scope:FinanceScope,period:string):FinanceData=>({
  scope,period,start:'',next:'',transactions:[],clients:[],accounts:{receivable:[],payable:[]},
  summary:{ledger:blankTotals(),realized:blankTotals(),planned:blankTotals(),currentBalance:0,receivable:0,payable:0,projectedBalance:0,overdueReceivable:0,overduePayable:0},
});

function periodTitle(scope:FinanceScope,period:string) {
  if(scope==='day') return displayDate(period);
  if(scope==='year') return `ano de ${period}`;
  return new Date(`${period}-02T12:00:00`).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
}

function PeriodInput({scope,period,onChange}:{scope:FinanceScope;period:string;onChange:(value:string)=>void}) {
  if(scope==='year') return <Input id="finance-period" type="number" min="2000" max="2100" value={period} onChange={event=>onChange(event.target.value)}/>;
  return <Input id="finance-period" type={scope==='day'?'date':'month'} value={period} onChange={event=>onChange(event.target.value)}/>;
}

function AccountsTable({title,kind,rows,onSettle}:{title:string;kind:'receivable'|'payable';rows:Account[];onSettle:(row:Account)=>void}) {
  return <Card className="content-card finance-account-card"><CardContent>
    <div className="section-toolbar"><div><h2>{title}</h2><p>{rows.length} compromisso(s) no período ou em atraso</p></div></div>
    <Table className="responsive-table"><TableHeader><TableRow><TableHead>Vencimento</TableHead><TableHead>Descrição</TableHead><TableHead>Valor</TableHead><TableHead>Situação</TableHead><TableHead>Ação</TableHead></TableRow></TableHeader><TableBody>
      {rows.length?rows.map(row=><TableRow key={row.id}>
        <TableCell data-label="Vencimento">{displayDate(row.dueDate)}</TableCell>
        <TableCell data-label="Descrição"><strong>{row.description}</strong>{row.clientName?<small>{row.clientName}</small>:null}</TableCell>
        <TableCell data-label="Valor"><strong className={`finance-value ${kind==='receivable'?'income':'expense'}`}>{money(row.amount)}</strong></TableCell>
        <TableCell data-label="Situação"><span className={`finance-account-status ${row.overdue?'overdue':'scheduled'}`}>{row.overdue?'Em atraso':'Programado'}</span></TableCell>
        <TableCell data-label="Ação">{row.transactionId?<Button size="sm" variant="outline" onClick={()=>onSettle(row)}><CheckCircle2/>Baixar</Button>:<small>Receba no cadastro do cliente</small>}</TableCell>
      </TableRow>):<TableRow><TableCell colSpan={5} className="empty-cell">Nenhuma conta nesta visão.</TableCell></TableRow>}
    </TableBody></Table>
  </CardContent></Card>;
}

export default function FinancePanel({onNotice}:{onNotice:(message:string)=>void}) {
  const [scope,setScope]=useState<FinanceScope>('month');
  const [period,setPeriod]=useState(()=>initialPeriod('month'));
  const [data,setData]=useState<FinanceData>(()=>emptyData('month',initialPeriod('month')));
  const [loading,setLoading]=useState(true);
  const [open,setOpen]=useState(false);
  const [reconcileOpen,setReconcileOpen]=useState(false);
  const [editing,setEditing]=useState<Transaction|null>(null);
  const [draftType,setDraftType]=useState<TransactionType>('expense');
  const [draftStatus,setDraftStatus]=useState<TransactionStatus>('realized');
  const [busy,setBusy]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);
    try {
      const response=await fetch(`/api/finance?scope=${scope}&period=${encodeURIComponent(period)}`,{cache:'no-store'});
      const result=await response.json() as FinanceData&{error?:string};
      if(!response.ok) throw new Error(result.error||'Não foi possível carregar o financeiro.');
      setData(result);
    } catch(error) { onNotice(error instanceof Error?error.message:'Não foi possível carregar o financeiro.'); }
    finally { setLoading(false); }
  },[scope,period,onNotice]);
  // Fetching the selected period is the external synchronization performed by this effect.
  // oxlint-disable-next-line react/react-compiler
  useEffect(()=>{void load()},[load]);

  const changeScope=(nextScope:FinanceScope)=>{setScope(nextScope);setPeriod(initialPeriod(nextScope))};
  const startCreate=(type:TransactionType='expense',status:TransactionStatus='realized')=>{
    setEditing(null);setDraftType(type);setDraftStatus(status);setOpen(true);
  };
  const startEdit=(item:Transaction)=>{
    setEditing(item);setDraftType(item.type);setDraftStatus(item.status);setOpen(true);
  };
  const post=async(body:Record<string,unknown>)=>{
    const response=await fetch('/api/finance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const result=await response.json() as {error?:string};
    if(!response.ok) throw new Error(result.error||'Não foi possível concluir a operação financeira.');
  };
  const save=async(event:SyntheticEvent<HTMLFormElement>)=>{
    event.preventDefault();setBusy(true);
    const form=new FormData(event.currentTarget);
    try {
      await post({
        action:editing?'updateTransaction':'createTransaction',id:editing?.id,type:draftType,status:draftStatus,
        category:form.get('category'),description:form.get('description'),amount:form.get('amount'),
        transactionDate:form.get('transactionDate'),clientId:draftType==='income'?form.get('clientId'):null,
      });
      setOpen(false);setEditing(null);await load();onNotice(editing?'Lançamento atualizado.':'Lançamento registrado.');
    } catch(error) { onNotice(error instanceof Error?error.message:'Não foi possível salvar o lançamento.'); }
    finally { setBusy(false); }
  };
  const settle=async(item:Transaction|Account)=>{
    const transactionId='transactionId' in item?item.transactionId:item.id;
    if(!transactionId||!confirm(`Confirmar a baixa de “${item.description}” em ${displayDate(today())}?`)) return;
    try { await post({action:'settleTransaction',id:transactionId,settledDate:today()});await load();onNotice('Lançamento baixado e incluído no saldo realizado.'); }
    catch(error){onNotice(error instanceof Error?error.message:'Não foi possível baixar o lançamento.');}
  };
  const remove=async(item:Transaction)=>{
    if(!confirm(`Excluir o lançamento “${item.description}”? A exclusão ficará registrada na auditoria.`))return;
    try {await post({action:'deleteTransaction',id:item.id});await load();onNotice('Lançamento excluído.');}
    catch(error){onNotice(error instanceof Error?error.message:'Não foi possível excluir.');}
  };
  const reconcile=async(event:SyntheticEvent<HTMLFormElement>)=>{
    event.preventDefault();setBusy(true);const form=new FormData(event.currentTarget);
    try {
      await post({action:'reconcileBalance',targetBalance:form.get('targetBalance'),transactionDate:form.get('transactionDate')});
      setReconcileOpen(false);await load();onNotice('Saldo conciliado. Se havia diferença, o ajuste ficou registrado na auditoria.');
    } catch(error){onNotice(error instanceof Error?error.message:'Não foi possível conciliar o saldo.');}
    finally{setBusy(false)}
  };
  const realizedResult=data.summary.realized.income-data.summary.realized.expense-data.summary.realized.investment;

  return <>
    <div className="page-heading"><div className="page-icon"><Landmark/></div><h1>Financeiro da Empresa</h1><p>Caixa realizado, compromissos e planejamento reconciliados em uma só visão</p></div>
    <fieldset className="finance-scope-tabs"><legend className="sr-only">Periodicidade do indicador</legend>
      {(['day','month','year'] as FinanceScope[]).map(item=><Button key={item} size="sm" variant={scope===item?'default':'outline'} onClick={()=>changeScope(item)}>{item==='day'?'Diário':item==='month'?'Mensal':'Anual'}</Button>)}
    </fieldset>
    <div className="finance-toolbar">
      <label htmlFor="finance-period"><span>Período</span><PeriodInput scope={scope} period={period} onChange={setPeriod}/></label>
      <div><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={loading?'spin':''}/>Atualizar</Button><Button variant="outline" onClick={()=>setReconcileOpen(true)}><Scale/>Conciliar saldo</Button><Button onClick={()=>startCreate()}><Plus/>Novo lançamento</Button></div>
    </div>
    <section className="finance-metrics" aria-label={`Resumo financeiro de ${periodTitle(scope,period)}`}>
      <Card className={`finance-metric balance ${data.summary.currentBalance<0?'negative':''}`}><CardContent><WalletCards/><span>Saldo disponível</span><strong>{money(data.summary.currentBalance)}</strong><small>Entradas realizadas menos saídas e investimentos realizados</small></CardContent></Card>
      <Card className="finance-metric income"><CardContent><ArrowUpCircle/><span>Entrou no período</span><strong>{money(data.summary.realized.income)}</strong><small>Somente receitas efetivamente recebidas</small></CardContent></Card>
      <Card className="finance-metric expense"><CardContent><ArrowDownCircle/><span>Saiu no período</span><strong>{money(data.summary.realized.expense)}</strong><small>Despesas efetivamente pagas</small></CardContent></Card>
      <Card className="finance-metric investment"><CardContent><BriefcaseBusiness/><span>Investido no período</span><strong>{money(data.summary.realized.investment)}</strong><small>Investimentos efetivamente pagos</small></CardContent></Card>
      <Card className={`finance-metric balance ${realizedResult<0?'negative':''}`}><CardContent><TrendingUp/><span>Resultado do período</span><strong>{money(realizedResult)}</strong><small>Movimentação realizada em {periodTitle(scope,period)}</small></CardContent></Card>
    </section>
    <section className="finance-planning" aria-label="Planejamento e compromissos">
      <Card><CardContent><Clock3/><span>A receber</span><strong>{money(data.summary.receivable)}</strong><small>Em atraso: {money(data.summary.overdueReceivable)}</small></CardContent></Card>
      <Card><CardContent><Clock3/><span>A pagar</span><strong>{money(data.summary.payable)}</strong><small>Em atraso: {money(data.summary.overduePayable)}</small></CardContent></Card>
      <Card><CardContent><TrendingUp/><span>Saldo projetado</span><strong>{money(data.summary.projectedBalance)}</strong><small>Saldo disponível + recebíveis − pagamentos</small></CardContent></Card>
      <Card><CardContent><WalletCards/><span>Planejado no período</span><strong>{money(data.summary.planned.income-data.summary.planned.expense-data.summary.planned.investment)}</strong><small>Receitas {money(data.summary.planned.income)} · Saídas {money(data.summary.planned.expense+data.summary.planned.investment)}</small></CardContent></Card>
    </section>
    <div className="finance-actions"><Button variant="outline" onClick={()=>startCreate('income')}><ArrowUpCircle/>Lançar receita</Button><Button variant="outline" onClick={()=>startCreate('expense')}><ArrowDownCircle/>Lançar despesa</Button><Button variant="outline" onClick={()=>startCreate('investment')}><BriefcaseBusiness/>Lançar investimento</Button><Button variant="outline" onClick={()=>startCreate('expense','planned')}><Clock3/>Programar pagamento</Button></div>
    <div className="finance-accounts-grid">
      <AccountsTable title="Contas a receber" kind="receivable" rows={data.accounts.receivable} onSettle={item=>void settle(item)}/>
      <AccountsTable title="Contas a pagar" kind="payable" rows={data.accounts.payable} onSettle={item=>void settle(item)}/>
    </div>
    <Card className="content-card finance-table"><CardContent>
      <div className="section-toolbar"><div><h2>Lançamentos de {periodTitle(scope,period)}</h2><p>{data.transactions.length} registro(s) no período</p></div></div>
      <Table className="responsive-table"><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Situação</TableHead><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Cliente</TableHead><TableHead>Valor</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>
        {data.transactions.length?data.transactions.map(item=><TableRow key={item.id}>
          <TableCell data-label="Data">{displayDate(item.status==='realized'?(item.settledDate||item.transactionDate):item.transactionDate)}</TableCell>
          <TableCell data-label="Situação"><span className={`finance-transaction-status ${item.status}`}>{item.status==='realized'?'Realizado':'Planejado'}</span></TableCell>
          <TableCell data-label="Tipo"><span className={`finance-type ${item.type}`}>{typeLabel[item.type]}</span></TableCell>
          <TableCell data-label="Descrição"><strong>{item.description}</strong><small>{sourceLabel[item.source]||`Lançado por ${item.createdByName||'usuário removido'}`}</small></TableCell>
          <TableCell data-label="Categoria">{item.category}</TableCell><TableCell data-label="Cliente">{item.clientName||'—'}</TableCell>
          <TableCell data-label="Valor"><strong className={`finance-value ${item.type}`}>{item.type==='income'?'+':'−'} {money(item.amount)}</strong></TableCell>
          <TableCell data-label="Ações"><div className="row-actions">{item.status==='planned'?<Button size="icon-sm" variant="outline" aria-label={`Baixar ${item.description}`} onClick={()=>void settle(item)}><CheckCircle2/></Button>:null}<Button size="icon-sm" variant="outline" aria-label={`Editar ${item.description}`} onClick={()=>startEdit(item)}><Pencil/></Button><Button size="icon-sm" variant="destructive" aria-label={`Excluir ${item.description}`} onClick={()=>void remove(item)}><Trash2/></Button></div></TableCell>
        </TableRow>):<TableRow><TableCell colSpan={8} className="empty-cell">{loading?'Carregando lançamentos...':'Nenhum lançamento neste período.'}</TableCell></TableRow>}
      </TableBody></Table>
    </CardContent></Card>
    <p className="security-note finance-security"><ShieldCheck/>O saldo considera apenas valores realizados. Valores planejados aparecem na projeção até serem baixados. Todas as alterações ficam separadas por empresa e são auditadas.</p>

    <Dialog open={open} onOpenChange={value=>{setOpen(value);if(!value)setEditing(null)}}><DialogContent className="customer-dialog"><DialogHeader><DialogTitle>{editing?'Editar lançamento':'Novo lançamento'}</DialogTitle><DialogDescription>Registre o que já movimentou a conta ou programe um compromisso futuro.</DialogDescription></DialogHeader>
      <form key={editing?.id??`new-${draftType}-${draftStatus}`} className="stack-form" onSubmit={save}>
        <label className="field-label" htmlFor="finance-status"><span>Situação</span><select id="finance-status" value={draftStatus} onChange={event=>setDraftStatus(event.target.value as TransactionStatus)}><option value="realized">Realizado — já entrou ou saiu da conta</option><option value="planned">Planejado — ainda será recebido ou pago</option></select></label>
        <label className="field-label" htmlFor="finance-type"><span>Tipo</span><select id="finance-type" value={draftType} onChange={event=>setDraftType(event.target.value as TransactionType)}><option value="income">Receita</option><option value="expense">Despesa</option><option value="investment">Investimento</option></select></label>
        {draftType==='income'?<label className="field-label" htmlFor="finance-client"><span>Cliente relacionado (opcional)</span><select id="finance-client" name="clientId" defaultValue={editing?.clientId??''}><option value="">Receita sem cliente específico</option>{data.clients.map(client=><option key={client.id} value={client.id}>{client.name} — {money(client.amount)}</option>)}</select></label>:null}
        <label className="field-label" htmlFor="finance-category"><span>Categoria</span><Input id="finance-category" name="category" list={`finance-categories-${draftType}`} required defaultValue={editing?.category??categories[draftType][0]}/><datalist id={`finance-categories-${draftType}`}>{categories[draftType].map(category=><option key={category} value={category}>{category}</option>)}</datalist></label>
        <label className="field-label" htmlFor="finance-description"><span>Descrição</span><Input id="finance-description" name="description" required maxLength={300} placeholder="Ex.: Hospedagem do sistema" defaultValue={editing?.description??''}/></label>
        <label className="field-label" htmlFor="finance-amount"><span>Valor (R$)</span><Input id="finance-amount" name="amount" type="number" min="0.01" step="0.01" required defaultValue={editing?.amount??''}/></label>
        <label className="field-label" htmlFor="finance-date"><span>{draftStatus==='planned'?'Data de vencimento':'Data da movimentação'}</span><Input id="finance-date" name="transactionDate" type="date" required defaultValue={editing?.transactionDate??today()}/></label>
        <Button type="submit" disabled={busy}><Plus/>{busy?'Salvando...':editing?'Salvar alterações':'Registrar lançamento'}</Button>
      </form>
    </DialogContent></Dialog>
    <Dialog open={reconcileOpen} onOpenChange={setReconcileOpen}><DialogContent className="customer-dialog"><DialogHeader><DialogTitle>Conciliar saldo disponível</DialogTitle><DialogDescription>Informe quanto existe realmente na conta. Se houver diferença, o sistema criará um ajuste identificado e auditado.</DialogDescription></DialogHeader>
      <form className="stack-form" onSubmit={reconcile}>
        <div className="reconcile-current"><span>Saldo calculado atualmente</span><strong>{money(data.summary.currentBalance)}</strong></div>
        <label className="field-label" htmlFor="reconcile-balance"><span>Saldo real da conta (R$)</span><Input id="reconcile-balance" name="targetBalance" type="number" step="0.01" required defaultValue={data.summary.currentBalance.toFixed(2)}/></label>
        <label className="field-label" htmlFor="reconcile-date"><span>Data da conciliação</span><Input id="reconcile-date" name="transactionDate" type="date" required defaultValue={today()}/></label>
        <Button type="submit" disabled={busy}><Scale/>{busy?'Conciliando...':'Conciliar e registrar diferença'}</Button>
      </form>
    </DialogContent></Dialog>
  </>;
}

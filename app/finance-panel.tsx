'use client';

import { type SyntheticEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownCircle, ArrowUpCircle, BriefcaseBusiness, Landmark, Pencil, Plus,
  RefreshCw, ShieldCheck, Trash2, TrendingUp, WalletCards,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Client = { id:number; name:string; amount:number; dueDate:string };
type TransactionType = 'income'|'expense'|'investment';
type Transaction = {
  id:number; clientId:number|null; clientName:string|null; createdByName:string|null;
  type:TransactionType; category:string; description:string; amount:number;
  transactionDate:string; source:string; createdAt:string;
};
type FinanceData = { month:string; transactions:Transaction[]; clients:Client[] };

const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
const typeLabel:Record<TransactionType,string>={income:'Receita',expense:'Despesa',investment:'Investimento'};
const categories:Record<TransactionType,string[]>={
  income:['Mensalidade de cliente','Venda','Serviço avulso','Outras receitas'],
  expense:['Hospedagem e sistemas','Marketing','Impostos e taxas','Prestadores','Escritório','Transporte','Outras despesas'],
  investment:['Equipamentos','Desenvolvimento','Capacitação','Marketing de crescimento','Outros investimentos'],
};

function monthTitle(month:string) {
  return new Date(`${month}-02T12:00:00`).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
}

export default function FinancePanel({onNotice}:{onNotice:(message:string)=>void}) {
  const [month,setMonth]=useState(new Date().toISOString().slice(0,7));
  const [data,setData]=useState<FinanceData>({month,transactions:[],clients:[]});
  const [loading,setLoading]=useState(true);
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState<Transaction|null>(null);
  const [draftType,setDraftType]=useState<TransactionType>('expense');
  const [busy,setBusy]=useState(false);

  const load=useCallback(async()=>{
    try {
      const response=await fetch(`/api/finance?month=${encodeURIComponent(month)}`,{cache:'no-store'});
      const result=await response.json() as FinanceData&{error?:string};
      if(!response.ok) throw new Error(result.error||'Não foi possível carregar o financeiro.');
      setData(result);
    } catch(error) { onNotice(error instanceof Error?error.message:'Não foi possível carregar o financeiro.'); }
    finally { setLoading(false); }
  },[month,onNotice]);
  // Loading the selected month is the external synchronization performed by this effect.
  // oxlint-disable-next-line react/react-compiler
  useEffect(()=>{void load()},[load]);

  const totals=useMemo(()=>data.transactions.reduce((sum,item)=>{
    sum[item.type]+=item.amount;
    return sum;
  },{income:0,expense:0,investment:0} as Record<TransactionType,number>),[data.transactions]);
  const contracted=data.clients.reduce((sum,client)=>sum+client.amount,0);
  const balance=totals.income-totals.expense-totals.investment;

  const startCreate=(type:TransactionType='expense')=>{setEditing(null);setDraftType(type);setOpen(true)};
  const startEdit=(item:Transaction)=>{setEditing(item);setDraftType(item.type);setOpen(true)};
  const save=async(event:SyntheticEvent<HTMLFormElement>)=>{
    event.preventDefault();
    setBusy(true);
    const form=new FormData(event.currentTarget);
    try {
      const response=await fetch('/api/finance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        action:editing?'updateTransaction':'createTransaction',id:editing?.id,type:draftType,
        category:form.get('category'),description:form.get('description'),amount:form.get('amount'),
        transactionDate:form.get('transactionDate'),clientId:draftType==='income'?form.get('clientId'):null,
      })});
      const result=await response.json() as {error?:string};
      if(!response.ok) throw new Error(result.error||'Não foi possível salvar o lançamento.');
      setOpen(false);setEditing(null);await load();onNotice(editing?'Lançamento atualizado.':'Lançamento registrado.');
    } catch(error) { onNotice(error instanceof Error?error.message:'Não foi possível salvar o lançamento.'); }
    finally { setBusy(false); }
  };
  const remove=async(item:Transaction)=>{
    if(!confirm(`Excluir o lançamento “${item.description}”?`))return;
    const response=await fetch('/api/finance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'deleteTransaction',id:item.id})});
    const result=await response.json() as {error?:string};
    if(!response.ok){onNotice(result.error||'Não foi possível excluir.');return}
    await load();onNotice('Lançamento excluído.');
  };

  return <>
    <div className="page-heading"><div className="page-icon"><Landmark/></div><h1>Financeiro da Empresa</h1><p>Receitas dos clientes, despesas e investimentos em um só lugar</p></div>
    <div className="finance-toolbar">
      <label htmlFor="finance-month"><span>Período</span><Input id="finance-month" type="month" value={month} onChange={event=>{setLoading(true);setMonth(event.target.value)}}/></label>
      <div><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={loading?'spin':''}/>Atualizar</Button><Button onClick={()=>startCreate()}><Plus/>Novo lançamento</Button></div>
    </div>
    <section className="finance-metrics" aria-label={`Resumo financeiro de ${monthTitle(month)}`}>
      <Card className="finance-metric expected"><CardContent><WalletCards/><span>Receita mensal prevista</span><strong>{money(contracted)}</strong><small>Soma atual dos valores dos clientes</small></CardContent></Card>
      <Card className="finance-metric income"><CardContent><ArrowUpCircle/><span>Recebido no mês</span><strong>{money(totals.income)}</strong><small>{data.transactions.filter(item=>item.type==='income').length} recebimento(s)</small></CardContent></Card>
      <Card className="finance-metric expense"><CardContent><ArrowDownCircle/><span>Gastos no mês</span><strong>{money(totals.expense)}</strong><small>Despesas operacionais</small></CardContent></Card>
      <Card className="finance-metric investment"><CardContent><BriefcaseBusiness/><span>Investido no mês</span><strong>{money(totals.investment)}</strong><small>Crescimento e estrutura</small></CardContent></Card>
      <Card className={`finance-metric balance ${balance<0?'negative':''}`}><CardContent><TrendingUp/><span>Saldo do mês</span><strong>{money(balance)}</strong><small>Receitas menos gastos e investimentos</small></CardContent></Card>
    </section>
    <div className="finance-actions"><Button variant="outline" onClick={()=>startCreate('income')}><ArrowUpCircle/>Lançar receita</Button><Button variant="outline" onClick={()=>startCreate('expense')}><ArrowDownCircle/>Lançar despesa</Button><Button variant="outline" onClick={()=>startCreate('investment')}><BriefcaseBusiness/>Lançar investimento</Button></div>
    <Card className="content-card finance-table"><CardContent>
      <div className="section-toolbar"><div><h2>Lançamentos de {monthTitle(month)}</h2><p>{data.transactions.length} registro(s) no período</p></div></div>
      <Table className="responsive-table"><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Cliente</TableHead><TableHead>Valor</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>
        {data.transactions.length?data.transactions.map(item=><TableRow key={item.id}>
          <TableCell data-label="Data">{new Date(`${item.transactionDate}T12:00:00`).toLocaleDateString('pt-BR')}</TableCell>
          <TableCell data-label="Tipo"><span className={`finance-type ${item.type}`}>{typeLabel[item.type]}</span></TableCell>
          <TableCell data-label="Descrição"><strong>{item.description}</strong><small>{item.source==='client_payment'?'Gerado ao receber e renovar':`Lançado por ${item.createdByName||'usuário removido'}`}</small></TableCell>
          <TableCell data-label="Categoria">{item.category}</TableCell><TableCell data-label="Cliente">{item.clientName||'—'}</TableCell>
          <TableCell data-label="Valor"><strong className={`finance-value ${item.type}`}>{item.type==='income'?'+':'−'} {money(item.amount)}</strong></TableCell>
          <TableCell data-label="Ações"><div className="row-actions"><Button size="icon-sm" variant="outline" aria-label={`Editar ${item.description}`} onClick={()=>startEdit(item)}><Pencil/></Button><Button size="icon-sm" variant="destructive" aria-label={`Excluir ${item.description}`} onClick={()=>void remove(item)}><Trash2/></Button></div></TableCell>
        </TableRow>):<TableRow><TableCell colSpan={7} className="empty-cell">{loading?'Carregando lançamentos...':'Nenhum lançamento neste mês.'}</TableCell></TableRow>}
      </TableBody></Table>
    </CardContent></Card>
    <p className="security-note finance-security"><ShieldCheck/>Este módulo só aparece para usuários com permissão financeira. Os lançamentos ficam separados por empresa e todas as alterações são auditadas.</p>

    <Dialog open={open} onOpenChange={value=>{setOpen(value);if(!value)setEditing(null)}}><DialogContent className="customer-dialog"><DialogHeader><DialogTitle>{editing?'Editar lançamento':'Novo lançamento'}</DialogTitle><DialogDescription>Registre o movimento com uma descrição clara para facilitar a conferência.</DialogDescription></DialogHeader>
      <form key={editing?.id??`new-${draftType}`} className="stack-form" onSubmit={save}>
        <label className="field-label" htmlFor="finance-type"><span>Tipo</span><select id="finance-type" name="type" value={draftType} onChange={event=>setDraftType(event.target.value as TransactionType)}><option value="income">Receita</option><option value="expense">Despesa</option><option value="investment">Investimento</option></select></label>
        {draftType==='income'&&<label className="field-label" htmlFor="finance-client"><span>Cliente relacionado (opcional)</span><select id="finance-client" name="clientId" defaultValue={editing?.clientId??''}><option value="">Receita sem cliente específico</option>{data.clients.map(client=><option key={client.id} value={client.id}>{client.name} — {money(client.amount)}</option>)}</select></label>}
        <label className="field-label" htmlFor="finance-category"><span>Categoria</span><Input id="finance-category" name="category" list={`finance-categories-${draftType}`} required defaultValue={editing?.category??categories[draftType][0]}/><datalist id={`finance-categories-${draftType}`}>{categories[draftType].map(category=><option key={category} value={category}>{category}</option>)}</datalist></label>
        <label className="field-label" htmlFor="finance-description"><span>Descrição</span><Input id="finance-description" name="description" required maxLength={300} placeholder="Ex.: Hospedagem do sistema" defaultValue={editing?.description??''}/></label>
        <label className="field-label" htmlFor="finance-amount"><span>Valor (R$)</span><Input id="finance-amount" name="amount" type="number" min="0.01" step="0.01" required defaultValue={editing?.amount??''}/></label>
        <label className="field-label" htmlFor="finance-date"><span>Data</span><Input id="finance-date" name="transactionDate" type="date" required defaultValue={editing?.transactionDate??new Date().toISOString().slice(0,10)}/></label>
        <Button type="submit" disabled={busy}><Plus/>{busy?'Salvando...':editing?'Salvar alterações':'Registrar lançamento'}</Button>
      </form>
    </DialogContent></Dialog>
  </>;
}

import {lazy,Suspense} from "react";
import {Link} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";
import {QueryState} from "../components/QueryState";
import {UiIcon} from "../components/UiIcon";
import {money} from "../domain/money";
import {pending} from "../domain/types";
import {useWorkspace} from "../hooks/workspace";
import {demoSummary} from "../services/demo";
const FinanceChart=lazy(()=>import("../components/FinanceChart"));

const names:Record<string,string>={"AGU. RECONFERENCIA":"Aguardando reconferência","AGU. ANALISE":"Aguardando análise","EM ANALISE":"Em análise","PENDENTE":"Pendente","APROVADO":"Aprovado","REPROVADO":"Reprovado","CANCELADO":"Cancelado","FORA DO PRAZO":"Fora do prazo"};
function name(value:string){return names[value]??value;}
export function Dashboard({canImport}:{canImport:boolean}){
 const {remote}=useWorkspace();
 const query=useQuery({queryKey:["summary"],queryFn:({signal})=>remote?remote.summary(signal):Promise.resolve(demoSummary())});
 const s=query.data;
 const pendingCount=s?Object.entries(s.status_counts).reduce((sum,[status,count])=>sum+(pending.has(status)?count:0),0):0;
 return <>
  <div className="page-heading dashboard-heading"><div><h1>Visão geral</h1><p className="muted">Central de recebimento de mercadorias</p></div>{canImport&&<Link className="primary" to={remote?"/chamados/novo":"/importar"}><UiIcon name="plus"/>{remote?"Novo chamado":"Nova importação"}</Link>}</div>
  <QueryState loading={query.isPending} error={query.error} retry={()=>void query.refetch()}/>
  {s&&<section aria-label="Indicadores principais" className="overview-metrics">
   <div className="overview-stat"><span>Total de chamados</span><strong>{s.occurrences}</strong><small>Registros no seu perfil</small></div>
   <div className="overview-stat"><span>Em andamento</span><strong>{pendingCount}</strong><small>Todos os status pendentes</small></div>
   <div className="overview-stat"><span>Aprovados</span><strong>{s.status_counts.APROVADO??0}</strong><small>Chamados aprovados</small></div>
   <div className="overview-stat"><span>Prazo decorrido</span><strong>{s.deadline_counts?.overdue??"—"}</strong><small>{s.deadline_counts?"Pendentes fora do prazo":"Calendário não configurado"}</small></div>
  </section>}
  <section className="panel work-actions" aria-label="Atalhos de trabalho">
    <h2>O que você precisa fazer?</h2>
    <div className="quick-actions">
     <Link to="/chamados"><span className="action-icon"><UiIcon name="/chamados" size={22}/></span><span><strong>Consultar chamados</strong><small>Pesquisar e acompanhar divergências</small></span><UiIcon name="arrow"/></Link>
     {remote&&<Link to="/fornecedores"><span className="action-icon"><UiIcon name="/fornecedores" size={22}/></span><span><strong>Conferências</strong><small>Registrar ou consultar fornecedores</small></span><UiIcon name="arrow"/></Link>}
     <Link to="/inventarios"><span className="action-icon"><UiIcon name="/inventarios" size={22}/></span><span><strong>Conferir inventário</strong><small>Cruzar divergências e chamados</small></span><UiIcon name="arrow"/></Link>
    </div>
  </section>
  {s&&<div className="dashboard-columns">
   <section className="panel stack"><div className="section-heading"><h2>Situação dos chamados</h2><Link className="text-link" to="/chamados">Ver chamados</Link></div>
   {s.occurrences===0?<div className="empty-state"><UiIcon name="/chamados" size={28}/><strong>Nenhum chamado registrado</strong><p>Os chamados aparecerão aqui após o primeiro registro ou importação.</p>{canImport&&<Link className="secondary" to={remote?"/chamados/novo":"/importar"}>Começar</Link>}</div>:<ul className="status-list">{Object.entries(s.status_counts).filter(([,count])=>count>0).sort((a,b)=>b[1]-a[1]).map(([status,count])=><li key={status}><Link to={"/chamados?status="+encodeURIComponent(status)}><span>{name(status)}</span><strong>{count}</strong></Link><div className="status-track"><span style={{width:Math.min(100,s.occurrences?count/s.occurrences*100:0)+"%"}}/></div></li>)}</ul>}
   {s.deadline_counts&&<p className="muted">Dentro do prazo: {s.deadline_counts.within} · Sem data suficiente: {s.deadline_counts.missing_date}</p>}
   </section>
   <section className="panel stack"><h2>Financeiro</h2><div className="finance-total"><span>Saldo informado</span><strong>{money(s.net_reported)}</strong><small>Valores registrados nas divergências</small></div>
   <dl className="finance-list">{([["approved","Aprovado conferido"],["recovered","Recuperado conferido"],["pending","Pendente conferido"]] as const).map(([key,label])=><div key={key}><dt>{label}{s.financial_counts&&<small>{s.financial_counts[key]} chamados informados</small>}</dt><dd>{money(s[key])}</dd></div>)}</dl>
   <details className="progressive"><summary>Detalhes financeiros</summary><dl className="finance-list">{Object.entries(s.totals_by_reason).map(([reason,total])=><div key={reason}><dt>{reason}</dt><dd>{money(total)}</dd></div>)}</dl>{Object.keys(s.totals_by_reason).length>0&&<Suspense fallback={<p className="muted">Carregando gráfico…</p>}><FinanceChart totals={s.totals_by_reason}/></Suspense>}<p className="muted">{s.note}</p><p className="muted">Itens sem valor: {s.items_without_value}. Motivo não classificado: {s.items_unknown_reason??0}.</p></details>
   </section>
  </div>}
 </>;
}

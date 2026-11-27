import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { QueryState } from "../components/QueryState";
import { money } from "../domain/money";
import { useWorkspace } from "../hooks/workspace";
import { demoSummary } from "../services/demo";

const FinanceChart = lazy(() => import("../components/FinanceChart"));

export function Dashboard({ canImport }: { canImport: boolean }) {
  const { remote } = useWorkspace();
  const query = useQuery({
    queryKey: ["summary"],
    queryFn: ({ signal }) =>
      remote ? remote.summary(signal) : Promise.resolve(demoSummary()),
  });
  const summary = query.data;
  return (
    <>
      <div className="page-heading">
        <div><h1>Visão geral</h1><p className="muted">Acompanhe as pendências do recebimento.</p></div>
        {canImport && (
          <Link className="primary" to={remote ? "/chamados/novo" : "/importar"}>
            {remote ? "Novo chamado" : "Nova importação"}
          </Link>
        )}
      </div>
      <section className="quick-actions" aria-label="Atalhos de trabalho"><Link to="/chamados"><strong>Consultar chamados</strong><small>Pesquisar e acompanhar divergências</small></Link>{remote&&<Link to="/fornecedores"><strong>Conferências</strong><small>Consultar fornecedores recebidos</small></Link>}<Link to="/inventarios"><strong>Conferir inventário</strong><small>Cruzar divergências e chamados</small></Link></section>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {summary && (
        <>
          <section className="panel stack">
            <h2>Situação dos chamados</h2>
            <dl className="metrics">
              <div>
                <dt>Chamados</dt>
                <dd>{summary.occurrences}</dd>
              </div>
              <div>
                <dt>Pendentes</dt>
                <dd>{summary.status_counts.PENDENTE??0}</dd>
              </div>
              
              {Object.entries(summary.status_counts).filter(([status])=>status!=="PENDENTE").map(([status, count]) => (
                <div key={status}>
                  <dt>{status}</dt>
                  <dd>{count}</dd>
                </div>
              ))}
            </dl>
            {Object.keys(summary.status_counts).length > 0 && (<details className="progressive"><summary>Ver gráfico por status</summary>
              <Suspense fallback={null}>
                <FinanceChart
                  totals={Object.fromEntries(
                    Object.entries(summary.status_counts).map(
                      ([name, count]) => [name, String(count)],
                    ),
                  )}
                  counts
                />
              </Suspense></details>
            )}
          </section>
          {remote && <section className="panel stack"><h2>Prazos dos chamados pendentes</h2>{summary.deadline_counts ? <dl className="metrics"><div><dt>Dentro do prazo</dt><dd>{summary.deadline_counts.within}</dd></div><div><dt>Prazo decorrido</dt><dd>{summary.deadline_counts.overdue}</dd></div><div><dt>Data insuficiente</dt><dd>{summary.deadline_counts.missing_date}</dd></div></dl>:<p className="muted">Calendário operacional ainda não configurado.</p>}</section>}
          <section className="panel stack">
            <h2>Financeiro</h2>
            <p className="muted">Valores informados e conferidos. Dados ausentes não são estimados.</p>
            <dl className="metrics">
              {Object.entries(summary.totals_by_reason).map(
                ([reason, total]) => (
                  <div key={reason}>
                    <dt>{reason}</dt>
                    <dd>{money(total)}</dd>
                  </div>
                ),
              )}
              <div>
                <dt>Saldo informado</dt>
                <dd>{money(summary.net_reported)}</dd>
              </div>
              <div>
                <dt>Aprovado conferido</dt>
                <dd>{money(summary.approved)}</dd>{summary.financial_counts&&<small>{summary.financial_counts.approved} chamados informados</small>}
              </div>
              <div>
                <dt>Recuperado conferido</dt>
                <dd>{money(summary.recovered)}</dd>{summary.financial_counts&&<small>{summary.financial_counts.recovered} chamados informados</small>}
              </div>
              <div>
                <dt>Pendente conferido</dt>
                <dd>{money(summary.pending)}</dd>{summary.financial_counts&&<small>{summary.financial_counts.pending} chamados informados</small>}
              </div>
            </dl>
            <details className="progressive"><summary>Ver gráfico e detalhes dos valores</summary><Suspense
              fallback={<div className="skeleton">Carregando gráfico…</div>}
            >
              <FinanceChart totals={summary.totals_by_reason} />
            </Suspense>
            <p className="muted">{summary.note}</p><p className="muted">Itens sem valor: {summary.items_without_value}. Itens com motivo não classificado: {summary.items_unknown_reason??0}.</p></details>
          </section>
        </>
      )}
    </>
  );
}

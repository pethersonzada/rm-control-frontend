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
        <h1>Visão geral</h1>
        {canImport && (
          <Link className="primary" to="/importar">
            Nova importação
          </Link>
        )}
      </div>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {summary && (
        <>
          <section className="panel stack">
            <h2>Operação</h2>
            <dl className="metrics">
              <div>
                <dt>Chamados</dt>
                <dd>{summary.occurrences}</dd>
              </div>
              <div>
                <dt>Itens sem valor informado</dt>
                <dd>{summary.items_without_value}</dd>
              </div>
              {Object.entries(summary.status_counts).map(([status, count]) => (
                <div key={status}>
                  <dt>{status}</dt>
                  <dd>{count}</dd>
                </div>
              ))}
            </dl>
            {Object.keys(summary.status_counts).length > 0 && (
              <Suspense fallback={null}>
                <FinanceChart
                  totals={Object.fromEntries(
                    Object.entries(summary.status_counts).map(
                      ([name, count]) => [name, String(count)],
                    ),
                  )}
                  counts
                />
              </Suspense>
            )}
          </section>
          <section className="panel stack">
            <h2>Financeiro</h2>
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
                <dt>Aprovado</dt>
                <dd>{money(summary.approved)}</dd>
              </div>
              <div>
                <dt>Recuperado</dt>
                <dd>{money(summary.recovered)}</dd>
              </div>
              <div>
                <dt>Pendente</dt>
                <dd>{money(summary.pending)}</dd>
              </div>
            </dl>
            <Suspense
              fallback={<div className="skeleton">Carregando gráfico…</div>}
            >
              <FinanceChart totals={summary.totals_by_reason} />
            </Suspense>
            <p className="muted">{summary.note}</p>
          </section>
        </>
      )}
    </>
  );
}

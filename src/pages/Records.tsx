import { useDeferredValue, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TicketForm } from "./Tickets";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RecordTable } from "../components/RecordTable";
import { QueryState } from "../components/QueryState";
import { downloadReport } from "../domain/report";
import { statuses, type Filters, type Occurrence } from "../domain/types";
import { useWorkspace } from "../hooks/workspace";
import { demoRecords } from "../services/demo";

export function Records() {
  const { remote, identity } = useWorkspace();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Occurrence | null>(null);
  const delayed = useDeferredValue(search);
  const [status, setStatus] = useState("");
  const [store, setStore] = useState("");
  const [reason, setReason] = useState("");
  const [dateField, setDateField] = useState<Filters["date_field"]>("included");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [includeTests, setIncludeTests] = useState(false);
  const [cursors, setCursors] = useState([0]);
  const [ascending, setAscending] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState("");
  const filters: Filters = {
    search: delayed.trim(),
    status,
    store,
    reason,
    date_field: dateField,
    from_date: from,
    to_date: to,
    include_tests: includeTests,
    order: ascending ? "code_asc" : "code_desc",
  };
  const invalidDates = Boolean(from && to && from > to);
  const cursor = cursors.at(-1) || 0;
  const [exportController, setExportController] =
    useState<AbortController | null>(null);
  useEffect(() => () => exportController?.abort(), [exportController]);
  const query = useQuery({
    queryKey: ["records", filters, cursor],
    enabled: !invalidDates,
    queryFn: ({ signal }) =>
      remote
        ? remote.records(filters, cursor, signal)
        : Promise.resolve(demoRecords(filters, cursor)),
  });
  const data = query.data?.records || [];

  async function exportCsv() {
    setError("");
    setExporting(true);
    const controller = new AbortController();
    setExportController(controller);
    try {
      if (!remote) {
        downloadReport(demoRecords(filters, 0).records);
        return;
      }
      const all: Occurrence[] = [];
      let next: number | null = 0;
      while (next !== null) {
        const page = await remote.records(filters, next, controller.signal);
        all.push(...page.records);
        if (all.length > 10_000)
          throw new Error(
            "A exportação aceita até 10 mil chamados. Aplique mais filtros.",
          );
        next = page.next_cursor;
      }
      if (!controller.signal.aborted) downloadReport(all);
    } catch (caught) {
      if (!controller.signal.aborted) setError((caught as Error).message);
    } finally {
      setExporting(false);
      setExportController(null);
    }
  }

  async function exportXlsx() {
    if (!remote || exporting) return;
    setError(""); setExporting(true);
    const controller = new AbortController(); setExportController(controller);
    try {
      const blob = await remote.exportWorkbook(filters, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href=url; a.download="rm-control-chamados.xlsx"; a.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(caught) { if(!controller.signal.aborted)setError((caught as Error).message); }
    finally {setExporting(false);setExportController(null);}
  }
  if (editing) return <TicketForm record={editing} onCancel={()=>setEditing(null)}/>;
  return (
    <>
      <div className="page-heading"><div><h1>Chamados</h1><p className="muted">Consulte, atualize e exporte as ocorrências.</p></div><div className="actions">{remote && identity?.role !== "viewer" && <><Link className="secondary" to="/importar">Importar histórico</Link><Link className="primary" to="/chamados/novo">Novo chamado</Link></>}</div></div>
      <section className="panel stack" aria-label="Consulta de chamados">
        <div className="filter-grid primary-filters">
          <label>
            Pesquisar
            <input
              value={search}
              maxLength={100}
              placeholder="Chamado, carga ou PLU"
              onChange={(event) => {
                setCursors([0]);
                setSearch(event.target.value);
              }}
            />
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(event) => {
                setCursors([0]);
                setStatus(event.target.value);
              }}
            >
              <option value="">Todos</option>
              {statuses.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          {identity && (
            <label>
              Loja
              <select
                value={store}
                onChange={(event) => {
                  setCursors([0]);
                  setStore(event.target.value);
                }}
              >
                <option value="">Todas do meu perfil</option>
                {identity.stores.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <details className="progressive">
          <summary>Mais filtros{reason||from||to||includeTests||!ascending||dateField!=="included"?" · ativos":""}</summary>
          <div className="filter-grid"><label>
            Ordem
            <select
              value={ascending ? "ascending" : "descending"}
              onChange={(event) => {
                setCursors([0]);
                setAscending(event.target.value === "ascending");
              }}
            >
              <option value="ascending">Chamado crescente</option>
              <option value="descending">Chamado decrescente</option>
            </select>
          </label>
          <label>
            Motivo
            <select aria-label="Motivo"
              value={reason}
              onChange={(event) => {
                setCursors([0]);
                setReason(event.target.value);
              }}
            >
              <option value="">Todos</option>
              {["FALTA", "SOBRA", "AVARIA"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Data de referência
            <select
              value={dateField}
              onChange={(event) => {
                setCursors([0]);
                setDateField(event.target.value as Filters["date_field"]);
              }}
            >
              <option value="included">Inclusão</option>
              <option value="received">Recebimento</option>
            </select>
          </label>
          <label>
            De
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setCursors([0]);
                setFrom(event.target.value);
              }}
            />
          </label>
          <label>
            Até
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setCursors([0]);
                setTo(event.target.value);
              }}
            />
          </label>
        </div>
        {identity && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={includeTests}
              onChange={(event) => {
                setCursors([0]);
                setIncludeTests(event.target.checked);
              }}
            />{" "}
            Incluir chamados de teste
          </label>
        )}
        </details>
        {invalidDates && (
          <p className="error" role="alert">
            A data inicial precisa ser anterior ou igual à final.
          </p>
        )}
        <div className="actions">
          {remote && <button className="secondary" disabled={invalidDates||exporting} onClick={()=>void exportXlsx()}>Gerar planilha Excel</button>}
          <button
            className="secondary"
            onClick={() => void exportCsv()}
            disabled={invalidDates || !query.data || exporting}
          >
            {exporting ? "Exportando…" : "Exportar CSV"}
          </button>
          <button type="button" className="text-action" onClick={()=>{setSearch("");setStatus("");setStore("");setReason("");setDateField("included");setFrom("");setTo("");setIncludeTests(false);setAscending(true);setCursors([0]);}}>Limpar filtros</button>
          {exporting&&<button onClick={()=>exportController?.abort()}>Cancelar exportação</button>}
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
        <QueryState
          loading={!invalidDates && query.isPending}
          error={query.error}
          retry={() => void query.refetch()}
        />
        {query.data && (
          <>
            <p>{data.length} chamado(s) nesta página.</p>
            <RecordTable
              records={data}
              showHistory={Boolean(remote)}
              onNativeEdit={remote && identity?.role !== "viewer" ? setEditing : undefined}
              onStatus={
                remote && identity?.role !== "viewer"
                  ? async (record, target) => {
                      await remote.status(record, target);
                      await client.invalidateQueries();
                      setNotice("Status atualizado.");
                    }
                  : undefined
              }
            />
            <div className="actions">
              <button
                disabled={cursors.length === 1}
                onClick={() => setCursors(cursors.slice(0, -1))}
              >
                Anterior
              </button>
              <span>Página {cursors.length}</span>
              <button
                disabled={query.data.next_cursor === null}
                onClick={() => {
                  if (query.data.next_cursor !== null)
                    setCursors([...cursors, query.data.next_cursor]);
                }}
              >
                Próxima
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}

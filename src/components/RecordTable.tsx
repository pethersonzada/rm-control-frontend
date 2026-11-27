import { Fragment, useState } from "react";
import { FinancialReview } from "./FinancialReview";
import { TicketHistory } from "./TicketHistory";
import { money } from "../domain/money";
import { statuses, type Occurrence, type Preview } from "../domain/types";

export function RecordTable({
  records,
  onStatus,
  onEdit,
  onNativeEdit,
  classifications,
  showHistory = false,
}: {
  records: Occurrence[];
  onStatus?: (record: Occurrence, status: string) => Promise<void>;
  onEdit?: (record: Occurrence) => void;
  onNativeEdit?: (record: Occurrence) => void;
  classifications?: Preview["classifications"];
  showHistory?: boolean;
}) {
  const [open, setOpen] = useState("");
  if (!records.length)
    return <p className="empty">Nenhum chamado encontrado.</p>;

  return (
    <div
      className="table-wrap"
      role="region"
      aria-label="Tabela de chamados"
      tabIndex={0}
    >
      <table>
        <thead>
          <tr>
            <th scope="col">Chamado</th>
            <th scope="col">Loja e carga</th>
            <th scope="col">Motivo</th>
            <th scope="col">Inclusão</th>
            <th scope="col">Recebimento</th>
            <th scope="col">Status</th>
            <th scope="col">Itens</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const key = JSON.stringify([record.destination, record.code]);
            const expanded = key === open;
            const classification = classifications?.find(c=>c.code===record.code&&c.destination===record.destination)?.state;
            return (
              <Fragment key={key}>
                <tr>
                  <td>
                    <button
                      className="link-button"
                      aria-expanded={expanded}
                      onClick={() => setOpen(expanded ? "" : key)}
                    >
                      {record.external_code || (record.revision ? 'RM ' + record.code.slice(-10) : record.code)}
                    </button>
                    {classification && <small className={"import-state "+classification}>{({new:"Novo",updated:"Alteração",unchanged:"Sem alterações",conflicts:"Conflito"})[classification]}</small>}
                  </td>
                  <td>
                    {record.destination}
                    <small>{record.load || "—"}</small>
                  </td>
                  <td>{record.reason || "—"}</td>
                  <td>{record.included_at || "—"}</td>
                  <td>{record.received_at || "—"}</td>
                  <td>
                    <span className={"status status-"+record.status.toLowerCase().replace(/[^a-z]+/g,"-")}>{record.status}</span>
                    {record.is_test && <small>Teste</small>}
                    {record.due_at && (
                      <small>
                        Prazo {record.due_at.split("-").reverse().join("/")}
                        {record.deadline_passed ? " · prazo decorrido" : ""}
                      </small>
                    )}
                  </td>
                  <td>{record.items.length}</td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={7}>
                      <div className="record-details">
                        <p>
                          Origem {record.origin || "—"} · BDV{" "}
                          {record.bdv || "—"} · Notas{" "}
                          {record.invoices
                            ?.map(
                              (invoice) =>
                                invoice.number + "/" + invoice.series,
                            )
                            .join(", ") || "—"}
                        </p>
                        {onEdit && (
                          <div className="inline-form">
                            <label>
                              Motivo na prévia
                              <input
                                maxLength={200}
                                value={record.reason}
                                onChange={(event) =>
                                  onEdit({
                                    ...record,
                                    reason: event.target.value,
                                  })
                                }
                              />
                            </label>
                            <label>
                              Status na prévia
                              <select
                                value={record.status}
                                onChange={(event) =>
                                  onEdit({
                                    ...record,
                                    status: event.target.value,
                                  })
                                }
                              >
                                {[...new Set([record.status, ...statuses])].map(
                                  (status) => (
                                    <option key={status}>{status}</option>
                                  ),
                                )}
                              </select>
                            </label>
                          </div>
                        )}
                        {record.revision && <p className="muted">ID RM: <code className="user-uid">{record.code}</code></p>}
                        {onNativeEdit && record.revision && <button onClick={()=>onNativeEdit(record)}>Editar chamado</button>}
                        {onStatus && (
                          <StatusForm record={record} save={onStatus} />
                        )}
                        <h3>Produtos do chamado</h3><ul className="record-items">
                          {record.items.map((item, index) => (
                            <li key={index}>
                              {item.code} · {item.description} · {item.quantity}{" "}
                              {item.package} · {money(item.total)}
                              {item.unit_value != null && (
                                <small>
                                  Valor unitário {money(item.unit_value)}
                                </small>
                              )}
                            </li>
                          ))}
                        </ul>
                        {showHistory && <><FinancialReview key={"finance"+key} record={record}/><TicketHistory key={key} record={record}/></>}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusForm({
  record,
  save,
}: {
  record: Occurrence;
  save: NonNullable<Parameters<typeof RecordTable>[0]["onStatus"]>;
}) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="inline-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          await save(record, status);
          setStatus("");
        } catch (caught) {
          setError((caught as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="new-status">Novo status</label>
      <select
        id="new-status"
        value={status}
        onChange={(event) => setStatus(event.target.value)}
      >
        <option value="">Selecione</option>
        {statuses
          .filter((value) => value !== record.status)
          .map((value) => (
            <option key={value}>{value}</option>
          ))}
      </select>
      <button disabled={!status || busy}>Salvar status</button>
      {error && (
        <span role="alert" className="error">
          {error}
        </span>
      )}
    </form>
  );
}

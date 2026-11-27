import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RecordTable } from "../components/RecordTable";
import type { ImportState, Occurrence, Preview } from "../domain/types";
import { useWorkspace } from "../hooks/workspace";
import { ApiError } from "../services/api";
import {
  demoPreview,
  demoSave,
  scenarios,
  type Scenario,
} from "../services/demo";

const columns = ["DATA RECEBIMENTO", "LOJA", "PLU", "N° CHAMADO", "TIPO DA DIVERGENCIA", "QTD DIVERGENTE", "VALOR DA DIVERGENCIA", "DATA RETORNO CD", "CD ORIGEM", "N° BDV", "SITUACAO DO CHAMADO", "VOLUME", "DESCRICAO PRODUTO", "CATEGORIA"];
const labels: Record<ImportState, string> = {new:"Novos",updated:"Alterações",unchanged:"Sem alterações",conflicts:"Conflitos"};

export function ImportPage() {
  const { remote, identity } = useWorkspace();
  const client = useQueryClient();
  const [scenario, setScenario] = useState<Scenario>("list");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [part, setPart] = useState(0);
  const [editing, setEditing] = useState(false);
  const [source, setSource] = useState<"text" | "workbook">("text");
  const [busy, setBusy] = useState<"analyze" | "save" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Record<string,string>>({});
  const form = useRef<HTMLFormElement>(null);
  const saving = useRef(false);
  const sent = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const active = useRef<AbortController | null>(null);
  const batch = useRef("");

  useEffect(() => () => active.current?.abort(), []);

  function clear() {
    setPreview(null);
    setNotice("");
    setError("");
    setPart(0);
    setEditing(false);
  }

  function discard() {
    clear();
    form.current?.reset();
    setFile(null);
    setMapping({});
    sent.current = false;
  }

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || sent.current) return;
    clear();
    if (!remote) {
      setPreview(demoPreview(scenario));
      return;
    }
    const data = new FormData(event.currentTarget);
    const controller = new AbortController();
    active.current = controller;
    setBusy("analyze");
    try {
      if (
        source === "workbook" &&
        (!file || file.size === 0 || file.size > 21_000_000)
      ) {
        throw new Error("Selecione um arquivo XLSX de até 21 MB.");
      }
      const result =
        source === "workbook"
          ? await remote.workbook(
              file!,
              String(data.get("sheet") || "").trim(),
              data.has("partial"),
              controller.signal,
              Object.fromEntries(Object.entries(mapping).filter(([,value])=>value.trim()).map(([key,value])=>[key,value.trim()])),
            )
          : await remote.clipboard(
              String(data.get("text") || ""),
              String(data.get("code") || "").trim(),
              controller.signal,
              String(data.get("target_store") || ""),
            );
      if (!controller.signal.aborted) {
        batch.current = crypto.randomUUID();
        sent.current = false;
        setPreview(result);
      }
    } catch (caught) {
      if (controller.signal.aborted) setNotice("Prévia cancelada.");
      else setError((caught as Error).message);
    } finally {
      active.current = null;
      setBusy(null);
    }
  }

  function edit(record: Occurrence) {
    setEditing(false);
    batch.current = crypto.randomUUID();
    setPreview(
      (previous) =>
        previous && {
          ...previous,
          records: previous.records.map((item) =>
            item.code === record.code && item.destination === record.destination
              ? record
              : item,
          ),
        },
    );
  }

  async function confirm() {
    if (!preview || preview.blocked || !preview.records.length || saving.current) return;
    saving.current = true;
    sent.current = Boolean(remote);
    setBusy("save");
    setError("");
    try {
      const result = remote
        ? await remote.confirm(preview.records, batch.current)
        : demoSave(scenario);
      await client.invalidateQueries();
      discard();
      setNotice(`${result.saved} chamado(s) salvo(s).`);
    } catch (caught) {
      if (caught instanceof ApiError && ([400,401,403,413,422,429].includes(caught.status) || (caught.status===409 && caught.message.includes("depois da prévia")))) sent.current = false;
      setError((caught as Error).message);
    } finally {
      saving.current = false;
      setBusy(null);
    }
  }

  return (
    <>
      <h1>Importar dados</h1>
      <form ref={form} className="panel stack" onSubmit={analyze}>
        <fieldset disabled={busy !== null || sent.current}>
          {!remote ? (
            <>
              <label htmlFor="scenario">Cenário de importação</label>
              <select
                id="scenario"
                value={scenario}
                onChange={(event) => {
                  setScenario(event.target.value as Scenario);
                  clear();
                }}
              >
                {Object.entries(scenarios).map(([key, sample]) => (
                  <option key={key} value={key}>
                    {sample.label}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label htmlFor="source">Origem dos dados</label>
              <select
                id="source"
                value={source}
                onChange={(event) => {
                  setSource(event.target.value as typeof source);
                  discard();
                }}
              >
                <option value="text">Colar dados do sistema</option>
                <option value="workbook">Histórico XLSX</option>
              </select>
              {source === "text" ? (
                <>
                  <label htmlFor="clipboard">
                    Listagem e detalhes copiados
                  </label>
                  <p className="muted">Copie a tabela autorizada e cole aqui com Ctrl+V. Para um detalhe avulso, informe o chamado existente e a loja.</p>
                  <textarea
                    name="text"
                    id="clipboard"
                    rows={8}
                    required
                    maxLength={2_000_000}
                    onChange={clear}
                  />
                  <label htmlFor="code">
                    Código do chamado detalhado, se houver ambiguidade
                  </label>
                  <input
                    name="code"
                    id="code"
                    inputMode="numeric"
                    pattern="[0-9]+"
                    maxLength={40}
                    onChange={clear}
                  />
                  <label htmlFor="target-store">Loja do chamado detalhado (opcional)</label>
                  <select id="target-store" name="target_store" onChange={clear}><option value="">Detectar na listagem</option>{identity?.stores.map(s=><option key={s}>{s}</option>)}</select>
                </>
              ) : (
                <>
                  <label htmlFor="workbook">Planilha XLSX de até 21 MB</label>
                  <input
                    type="file"
                    id="workbook"
                    accept=".xlsx"
                    required
                    onChange={(event) => {
                      setFile(event.target.files?.[0] || null);
                      clear();
                    }}
                  />
                  <label htmlFor="sheet">
                    Nome da aba, se houver mais de uma aba compatível
                  </label>
                  <input
                    id="sheet"
                    name="sheet"
                    maxLength={31}
                    onChange={clear}
                  />
                  {file && <p className="muted">{file.name} · {(file.size/1_000_000).toFixed(2)} MB</p>}
                  <details><summary>Mapear cabeçalhos diferentes (opcional)</summary><p className="muted">Informe o título exato da sua planilha somente para colunas que têm outro nome.</p><div className="filter-grid">{columns.map(column=><label key={column}>{column}<input value={mapping[column]??""} maxLength={200} onChange={e=>{setMapping({...mapping,[column]:e.target.value});clear();}}/></label>)}</div></details>
                  <label className="checkbox">
                    <input type="checkbox" name="partial" onChange={clear} />
                    Excluir chamados com conflito e importar as linhas válidas
                  </label>
                </>
              )}
            </>
          )}
        </fieldset>
        <div className="actions">
          <button className="primary" disabled={busy !== null || sent.current}>
            Analisar dados
          </button>
          <button type="button" disabled={busy !== null} onClick={()=>{if(!sent.current||window.confirm("A gravação anterior pode ter sido concluída. Confira os chamados antes de abrir outro lote. Descartar a prévia?"))discard();}}>Limpar importação</button>
          {busy === "analyze" && (
            <button
              type="button"
              className="secondary"
              onClick={() => active.current?.abort()}
            >
              Cancelar prévia
            </button>
          )}
        </div>
        {busy === "analyze" && (
          <div role="status"><p>Enviando e analisando dados…</p><progress aria-label="Processando a importação" /></div>
        )}
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </form>
      {preview && (
        <section className="panel stack" aria-label="Prévia">
          <h2>Conferência da importação</h2>
          <p>
            {preview.records.length} chamado(s) reconhecido(s)
            {preview.sheet ? ` na aba ${preview.sheet}` : ""}.
          </p>
          {preview.comparison && <p className="muted">Comparação com o banco no momento da análise, antes de eventuais edições manuais.</p>}
          {preview.comparison && <dl className="metrics">{Object.entries(preview.comparison).map(([state,count])=><div key={state}><dt>{labels[state as ImportState]}</dt><dd>{count}</dd></div>)}</dl>}
          {preview.counts && (
            <p>
              {preview.counts.rows} linhas analisadas ·{" "}
              {preview.counts.invalid_rows} rejeitadas ·{" "}
              {preview.counts.omitted_rows} excluídas da importação ·{" "}
              {preview.counts.rows_without_value} sem valor informado
            </p>
          )}
          {preview.blocked && (
            <p role="alert" className="error">
              Corrija os registros na origem e analise novamente.
            </p>
          )}
          {preview.warnings.length > 0 && (
            <ul className="warnings">
              {preview.warnings.map((value, index) => (
                <li key={index}>{value}</li>
              ))}
            </ul>
          )}
          <RecordTable
            records={preview.records.slice(part * 50, (part + 1) * 50)}
            classifications={preview.classifications}
            onEdit={remote && !preview.blocked && !busy && !sent.current ? edit : undefined}
          />
          {preview.records.length > 50 && (
            <div className="actions">
              <button disabled={part === 0} onClick={() => setPart(part - 1)}>
                Anteriores
              </button>
              <button
                disabled={(part + 1) * 50 >= preview.records.length}
                onClick={() => setPart(part + 1)}
              >
                Próximos
              </button>
              <span>Página {part + 1}</span>
            </div>
          )}
          {remote && !preview.blocked && (
            <label className="checkbox">
              <input
                type="checkbox"
                disabled={busy !== null}
                checked={editing}
                onChange={(event) => setEditing(event.target.checked)}
              />
              Revisei a prévia e autorizo a gravação
            </label>
          )}
          <div className="actions">
            <button
              className="primary"
              onClick={() => void confirm()}
              disabled={
                busy !== null ||
                Boolean(preview.blocked) ||
                !preview.records.length ||
                Boolean(remote && !editing)
              }
            >
              {busy === "save" ? "Gravando…" : sent.current ? "Reenviar confirmação" : "Confirmar importação"}
            </button>
            <button disabled={busy !== null} onClick={()=>{if(!sent.current||window.confirm("A confirmação anterior pode ter sido gravada. Descartar?"))discard();}}>Cancelar importação</button>
          </div>
        </section>
      )}
    </>
  );
}

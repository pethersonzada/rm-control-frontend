import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RecordTable } from "../components/RecordTable";
import type { Occurrence, Preview } from "../domain/types";
import { useWorkspace } from "../hooks/workspace";
import {
  demoPreview,
  demoSave,
  scenarios,
  type Scenario,
} from "../services/demo";

export function ImportPage() {
  const { remote } = useWorkspace();
  const client = useQueryClient();
  const [scenario, setScenario] = useState<Scenario>("list");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [part, setPart] = useState(0);
  const [editing, setEditing] = useState(false);
  const [source, setSource] = useState<"text" | "workbook">("text");
  const [busy, setBusy] = useState<"analyze" | "save" | null>(null);
  const [file, setFile] = useState<File | null>(null);
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

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
            )
          : await remote.clipboard(
              String(data.get("text") || ""),
              String(data.get("code") || "").trim(),
              controller.signal,
            );
      batch.current = crypto.randomUUID();
      setPreview(result);
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
    if (!preview || preview.blocked || !preview.records.length) return;
    setBusy("save");
    setError("");
    try {
      const result = remote
        ? await remote.confirm(preview.records, batch.current)
        : demoSave(scenario);
      await client.invalidateQueries();
      setPreview(null);
      setNotice(`${result.saved} chamado(s) salvo(s).`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <h1>Importar dados</h1>
      <form className="panel stack" onSubmit={analyze}>
        <fieldset disabled={busy !== null}>
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
                  clear();
                }}
              >
                <option value="text">Texto copiado do sistema</option>
                <option value="workbook">Histórico XLSX</option>
              </select>
              {source === "text" ? (
                <>
                  <label htmlFor="clipboard">
                    Listagem e detalhes copiados
                  </label>
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
          <button className="primary" disabled={busy !== null}>
            Analisar dados
          </button>
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
          <p role="status">Enviando e analisando dados…</p>
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
            onEdit={remote && !preview.blocked && !busy ? edit : undefined}
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
              {busy === "save" ? "Gravando…" : "Confirmar importação"}
            </button>
          </div>
        </section>
      )}
    </>
  );
}

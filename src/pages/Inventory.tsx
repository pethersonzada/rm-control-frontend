import { useState, type FormEvent } from "react";
import { money } from "../domain/money";
import type { InventoryResult, InventoryRequest } from "../domain/types";
import { useWorkspace } from "../hooks/workspace";
import { demoInventory, demoInventoryInput } from "../services/demo";

function parseLines(text: string): InventoryRequest["items"] {
  const number = (value: string) => {
    const clean = value.trim().replace(/^R\$\s*/, "");
    if (!/^-?\d+(?:[.,]\d{1,8})?$/.test(clean))
      throw new Error("Use números sem separador de milhar.");
    return clean.replace(",", ".");
  };
  return text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      const [code, quantity, value, packaging, ...extra] = line.split(/[\t;]/);
      if (!/^\d{1,40}$/.test(code.trim()) || !quantity || extra.length) {
        throw new Error(
          `Linha ${index + 1}: informe PLU, quantidade, valor e embalagem opcionais.`,
        );
      }
      return {
        code: code.trim(),
        quantity: number(quantity),
        value: value?.trim() ? number(value) : null,
        package: packaging?.trim() || null,
      };
    });
}

export function Inventory() {
  const { remote, identity } = useWorkspace();
  const [result, setResult] = useState<InventoryResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function reconcile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setError("");
    setBusy(true);
    try {
      const data = new FormData(event.currentTarget);
      setResult(
        remote
          ? await remote.reconcile({
              destination: String(data.get("store")),
              items: parseLines(String(data.get("inventory"))),
            })
          : demoInventory(),
      );
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Inventários</h1>
      <form className="panel stack" onSubmit={reconcile}>
        <h2>Conferência de divergências</h2>
        {remote ? (
          <>
            <label htmlFor="inventory-store">Loja</label>
            <select name="store" id="inventory-store" required>
              <option value="">Selecione</option>
              {identity?.stores.map((store) => (
                <option key={store}>{store}</option>
              ))}
            </select>
            <label htmlFor="inventory-input">
              PLU, quantidade, valor e embalagem opcionais
            </label>
            <textarea
              name="inventory"
              id="inventory-input"
              rows={6}
              required
              maxLength={500_000}
              placeholder="100;2;19,90;CX-12"
            />
            <p className="muted">
              Separe os campos com tabulação ou ponto e vírgula. Para normalizar embalagens, informe a quarta coluna conforme o cadastro de referência. Se não informar valor, mantenha o terceiro campo vazio.
            </p>
          </>
        ) : (
          <p>
            {demoInventoryInput.destination} · PLU 100 · Quantidade 2 · Valor R$
            19,90
          </p>
        )}
        <div className="actions">
          <button className="primary" disabled={busy}>
            {busy ? "Conferindo…" : "Cruzar chamados pendentes"}
          </button>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </form>
      {result && (
        <section className="panel stack">
          <h2>Resultado da conferência</h2>
          <p>{result.note}</p>
          <div
            className="table-wrap"
            role="region"
            aria-label="Resultado do inventário"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">PLU</th>
                  <th scope="col">Divergência</th>
                  <th scope="col">Valor</th>
                  <th scope="col">Chamados pendentes</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.code}>
                    <td>{item.code}</td>
                    <td>{item.inventory_quantity}{item.inventory_normalized&&<small>{item.inventory_normalized.quantity} {item.inventory_normalized.unit} · {item.inventory_normalized.reference}</small>}</td>
                    <td>{money(item.inventory_value)}</td>
                    <td>
                      {item.pending.length
                        ? item.pending.map((pending) => (
                            <div key={pending.occurrence + pending.package}>
                              {pending.occurrence} · {pending.reason} ·{" "}
                              {pending.quantity} {pending.package} ·{" "}
                              {money(pending.total)}{pending.normalized&&<small>{pending.normalized.quantity} {pending.normalized.unit} · {pending.normalized.reference}</small>}
                            </div>
                          ))
                        : "Nenhum vínculo encontrado."}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import type { Identity } from "./domain/types";
import { WorkspaceContext } from "./hooks/workspace";
import { Dashboard } from "./pages/Dashboard";
import { ImportPage } from "./pages/Import";
import { Inventory } from "./pages/Inventory";
import { Records } from "./pages/Records";
import { api, demo } from "./services/api";
import { demoReset } from "./services/demo";

const pages = [
  ["/", "Visão geral"],
  ["/chamados", "Chamados"],
  ["/importar", "Importar dados"],
  ["/inventarios", "Inventários"],
];

export function App() {
  const client = useQueryClient();
  const [session, setSession] = useState<{
    remote: ReturnType<typeof api>;
    identity: Identity;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const canImport =
    demo ||
    session?.identity.role === "importer" ||
    session?.identity.role === "admin";

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = new FormData(event.currentTarget);
      const remote = api(String(data.get("credential") || "").trim());
      const identity = await remote.me();
      client.clear();
      setSession({ remote, identity });
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function resetDemo() {
    setError("");
    try {
      demoReset();
      setRevision((value) => value + 1);
      void client.invalidateQueries();
      setNotice("Demonstração limpa.");
    } catch {
      setError("O navegador não permitiu limpar o armazenamento.");
    }
  }

  if (!demo && !session) {
    return (
      <main className="sign-in">
        <form className="panel stack" onSubmit={connect}>
          <h1>RM Control</h1>
          <p>Acesse seu ambiente operacional com a credencial individual.</p>
          <label htmlFor="credential">Credencial individual</label>
          <input
            id="credential"
            name="credential"
            type="password"
            autoComplete="current-password"
            required
          />
          <button className="primary" disabled={busy}>
            {busy ? "Verificando…" : "Entrar"}
          </button>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </form>
      </main>
    );
  }

  return (
    <WorkspaceContext.Provider
      value={session || { remote: null, identity: null }}
    >
      <div className="layout">
        <a href="#conteudo" className="skip-link">
          Ir para o conteúdo
        </a>
        <aside>
          <div className="brand">
            RM Control <small>Operações logísticas</small>
          </div>
          <nav aria-label="Navegação principal">
            {pages
              .filter(([path]) => path !== "/importar" || canImport)
              .map(([path, label]) => (
                <NavLink key={path} to={path} end className="nav-link">
                  {label}
                </NavLink>
              ))}
          </nav>
          <div className="aside-bottom">
            {demo ? (
              <button className="secondary" onClick={resetDemo}>
                Limpar demonstração
              </button>
            ) : (
              <button
                className="secondary"
                onClick={() => {
                  client.clear();
                  setSession(null);
                }}
              >
                Sair
              </button>
            )}
          </div>
        </aside>
        <main id="conteudo" tabIndex={-1}>
          <header className="workspace-header">
            <span>
              {demo ? "Demonstração" : session?.identity.organization}
            </span>
            {session && (
              <span>
                {session.identity.subject} · {session.identity.role}
              </span>
            )}
          </header>
          {demo && (
            <p className="demo-notice">
              Use os cenários sintéticos. O progresso fica neste navegador e
              pode ser limpo a qualquer momento.
            </p>
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
          <Routes key={revision}>
            <Route path="/" element={<Dashboard canImport={canImport} />} />
            <Route path="/chamados" element={<Records />} />
            <Route
              path="/importar"
              element={canImport ? <ImportPage /> : <Navigate to="/" replace />}
            />
            <Route path="/inventarios" element={<Inventory />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </WorkspaceContext.Provider>
  );
}

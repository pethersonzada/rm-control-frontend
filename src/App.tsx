import { lazy, Suspense, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import type { Identity } from "./domain/types";
import { WorkspaceContext } from "./hooks/workspace";
import { Dashboard } from "./pages/Dashboard";
import { ImportPage } from "./pages/Import";
import { Inventory } from "./pages/Inventory";
import { Records } from "./pages/Records";
import { type api, demo } from "./services/api";
import { demoReset } from "./services/demo";

const FirebaseGate =
  import.meta.env.MODE === "demo"
    ? null
    : lazy(() => import("./pages/FirebaseGate"));
const Users = lazy(() => import("./pages/Users"));
const Stores = lazy(() => import("./pages/Stores"));
const NewTicket = lazy(() => import("./pages/Tickets"));

const pages = [
  ["/", "Visão geral"],
  ["/chamados", "Chamados"],
  ["/importar", "Importar dados"],
  ["/inventarios", "Inventários"],
  ["/usuarios", "Usuários"],
  ["/lojas", "Lojas"],
];

type Session = { remote: ReturnType<typeof api>; identity: Identity };

export function App() {
  if (demo || !FirebaseGate) return <Workspace session={null} />;
  return (
    <Suspense fallback={<main role="status">Preparando autenticação…</main>}>
      <FirebaseGate>
        {(session, logout, refresh) => (
          <Workspace
            key={session.identity.subject}
            session={session}
            logout={logout}
            refresh={refresh}
          />
        )}
      </FirebaseGate>
    </Suspense>
  );
}

function Workspace({
  session,
  logout,
  refresh,
}: {
  session: Session | null;
  logout?: () => void;
  refresh?: () => void;
}) {
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const canAdmin = session?.identity.role === "admin";
  const canManageStores = canAdmin && session?.identity.can_delegate_admin;
  const canImport = demo || session?.identity.role === "importer" || canAdmin;

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
              .filter(
                ([path]) =>
                  (path !== "/importar" || canImport) &&
                  (path !== "/usuarios" || canAdmin) &&
                  (path !== "/lojas" || canManageStores),
              )
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
              <button className="secondary" onClick={logout}>
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
            <Route path="/chamados/novo" element={!demo && canImport ? <Suspense fallback={<p role="status">Carregando formulário…</p>}><NewTicket /></Suspense> : <Navigate to="/chamados" replace />} />
            <Route path="/lojas" element={canManageStores ? <Suspense fallback={<p role="status">Carregando lojas…</p>}><Stores refresh={refresh ?? (() => {})} /></Suspense> : <Navigate to="/" replace />} />
            <Route
              path="/importar"
              element={canImport ? <ImportPage /> : <Navigate to="/" replace />}
            />
            <Route path="/inventarios" element={<Inventory />} />
            <Route
              path="/usuarios"
              element={
                canAdmin ? (
                  <Suspense
                    fallback={<p role="status">Carregando usuários…</p>}
                  >
                    <Users />
                  </Suspense>
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </WorkspaceContext.Provider>
  );
}

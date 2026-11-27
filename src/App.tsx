import { lazy, Suspense, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { Identity } from "./domain/types";
import { BrandLogo, ThemeControl } from "./components/Theme";
import { UiIcon } from "./components/UiIcon";
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
const Settings = lazy(() => import("./pages/Settings"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Catalog = lazy(() => import("./pages/Catalog"));
const NewTicket = lazy(() => import("./pages/Tickets"));

const groups = [
  {title:"Principal",pages:[["/","Visão geral"]]},
  {title:"Operação",pages:[["/chamados","Chamados"],["/fornecedores","Fornecedores conferidos"],["/inventarios","Inventários"],["/importar","Importar dados"]]},
  {title:"Administração",pages:[["/usuarios","Usuários"],["/lojas","Lojas"],["/catalogo","Catálogo"],["/configuracoes","Configurações"]]},
];
const roles:Record<string,string>={admin:"Administrador",importer:"Operador",viewer:"Consulta"};


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
  const location=useLocation();
  const [navOpen,setNavOpen]=useState(false);
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
          <div className="sidebar-top">
            <div className="brand"><BrandLogo className="brand-logo"/></div>
            <button className="mobile-menu" aria-expanded={navOpen} aria-controls="workspace-nav" onClick={()=>setNavOpen(v=>!v)}><UiIcon name="menu"/> Menu</button>
          </div>
          <nav id="workspace-nav" className={navOpen?"nav-open":""} aria-label="Navegação principal">
            {groups.map(group=>{
              const links=group.pages.filter(([path])=>
                (path!=="/importar"||canImport)&&(path!=="/usuarios"||canAdmin)&&
                (path!=="/fornecedores"||!demo)&&
                (!["/lojas","/catalogo","/configuracoes"].includes(path)||canManageStores));
              return links.length>0&&<div className="nav-group" key={group.title}>
                <p className="nav-caption">{group.title}</p>
                {links.map(([path,label])=><NavLink key={path} to={path} end={path==="/"} onClick={()=>setNavOpen(false)} className="nav-link"><UiIcon name={path}/><span>{label}</span></NavLink>)}
              </div>;
            })}
          </nav>
          <div className="aside-bottom">
            <div className="sidebar-account"><span className="account-avatar" aria-hidden="true">{demo?"D":(roles[session?.identity.role??""]??"U")[0]}</span><div><strong>{demo?"Demonstração":roles[session?.identity.role??""]??"Usuário"}</strong><small>{demo?"Dados fictícios":`Loja${(session?.identity.stores.length??0)>1?"s":""} ${session?.identity.stores.join(", ")||"—"}`}</small></div></div>
            {demo ? (
              <button className="secondary" onClick={resetDemo}>
                Limpar demonstração
              </button>
            ) : (
              <button className="secondary" onClick={logout}>
                <UiIcon name="logout"/> Sair
              </button>
            )}
          </div>
        </aside>
        <main id="conteudo" tabIndex={-1}>
          <header className="workspace-header">
            <span className="workspace-breadcrumb">{location.pathname==="/"?"Início":groups.find(g=>g.pages.some(([p])=>p!=="/"&&location.pathname.startsWith(p)))?.title??"Início"}</span>
            <div className="header-tools"><span className="environment-label">{demo?"Demonstração":"Homologação"}</span><ThemeControl/></div>
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
            <Route path="/configuracoes" element={canManageStores ? <Suspense fallback={<p role="status">Carregando configurações…</p>}><Settings /></Suspense> : <Navigate to="/" replace />} />
            <Route path="/fornecedores" element={!demo && session ? <Suspense fallback={<p role="status">Carregando conferências…</p>}><Suppliers /></Suspense> : <Navigate to="/" replace />} />
            <Route path="/catalogo" element={canManageStores ? <Suspense fallback={<p role="status">Carregando catálogo…</p>}><Catalog /></Suspense> : <Navigate to="/" replace />} />
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

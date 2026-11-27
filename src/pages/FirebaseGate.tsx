import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  onAuthStateChanged,
  signOut,
  type Auth,
  type User,
} from "@firebase/auth";
import { api, ApiError } from "../services/api";
import { firebaseAuth } from "../services/firebase";
import type { Identity } from "../domain/types";
import { AccessLayout, FirebaseAccess } from "./FirebaseAccess";

type Session = { remote: ReturnType<typeof api>; identity: Identity };

let authInstance: Auth | undefined;

export default function FirebaseGate({
  children,
}: {
  children: (session: Session, logout: () => void, refresh: () => void) => ReactNode;
}) {
  const client = useQueryClient();
  const [auth, setAuth] = useState<Auth>();
  const [fatal, setFatal] = useState("");
  const [user, setUser] = useState<User | null>();
  const [authorized, setAuthorized] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestNotice, setRequestNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const uid = useRef<string | null>(null);
  const pending = useRef<AbortController | null>(null);

  function logout() {
    if (!auth) return;
    pending.current?.abort();
    client.clear();
    setAuthorized(null);
    setUser(null);
    setError("");
    void signOut(auth).catch(() => setError("Falha ao sair. Tente novamente."));
  }

  useEffect(() => {
    try {
      authInstance ??= firebaseAuth();
      setAuth(authInstance);
    } catch (caught) {
      setFatal((caught as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!auth) return;
    let active: AbortController | null = null;
    let mounted = true;
    const unsubscribe = onAuthStateChanged(auth, (current) => {
      active?.abort();
      setUser(current);
      if (uid.current !== (current?.uid ?? null)) {
        uid.current = current?.uid ?? null;
        setRequestNotice("");
        client.clear();
        setAuthorized(null);
      }
      if (!current) {
        setChecking(false);
        return;
      }
      const operation = new AbortController();
      active = operation;
      pending.current = operation;
      setChecking(true);
      setError("");
      const remote = api(
        (force) => {
          if (auth.currentUser?.uid !== current.uid) throw new ApiError(401);
          return current.getIdToken(force);
        },
        (error) => {
          if (!mounted || auth.currentUser?.uid !== current.uid) return;
          client.clear();
          setAuthorized(null);
          setError(error.message);
          if (error.status === 401) void signOut(auth).catch(() => {});
        },
      );
      void remote
        .me(operation.signal)
        .then((identity) => {
          if (!operation.signal.aborted) {
            setAuthorized((previous) => {
              if (
                previous &&
                (previous.identity.role !== identity.role ||
                  previous.identity.organization !== identity.organization ||
                  previous.identity.stores.join("|") !==
                    identity.stores.join("|"))
              )
                client.clear();
              return { identity, remote };
            });
          }
        })
        .catch((caught) => {
          if (!operation.signal.aborted) {
            client.clear();
            setAuthorized(null);
            setError(
              caught instanceof ApiError
                ? caught.message
                : "Falha ao verificar o acesso. Tente novamente.",
            );
          }
        })
        .finally(() => {
          if (!operation.signal.aborted) setChecking(false);
        });
    });
    return () => {
      mounted = false;
      active?.abort();
      unsubscribe();
    };
  }, [auth, attempt, client]);

  if (authorized && user) return children(authorized, logout, () => setAttempt(value => value + 1));
  return (
    <AccessLayout>
      {fatal ? (
        <>
          <h1 id="access-title">Acesso indisponível</h1>
          <p role="alert" className="access-feedback error">
            {fatal}
          </p>
        </>
      ) : user === undefined || checking || !auth ? (
        <>
          <h1 id="access-title">Verificando acesso</h1>
          <p role="status" className="access-feedback">
            O servidor pode levar até um minuto para iniciar.
          </p>
        </>
      ) : user ? (
        <>
          <header className="access-heading">
            <h1 id="access-title">Acesso pendente</h1>
            <p>
              Solicite acesso para que o administrador possa liberar seu perfil e suas lojas. O UID também pode ser compartilhado diretamente com o responsável.
            </p>
          </header>
          {error && (
            <p role="alert" className="access-feedback error">
              {error}
            </p>
          )}
          <div className="access-uid">
            <strong>UID da conta</strong>
            <code className="user-uid">{user.uid}</code>
          </div>
          {requestNotice && <p role="status" className="notice">{requestNotice}</p>}
          <div className="access-actions">
            <button disabled={requesting} onClick={async () => {
              setRequesting(true); setRequestNotice("");
              try {
                const current = user;
                const remote = api(force => {
                  if (auth.currentUser?.uid !== current.uid) throw new ApiError(401);
                  return current.getIdToken(force);
                });
                const response = await remote.requestAccess();
                if (auth.currentUser?.uid === current.uid) setRequestNotice(response.status === "pending" ? "Solicitação enviada. Aguarde a aprovação." : response.status === "approved" ? "Conta vinculada. Verifique o acesso novamente." : "Solicitação recusada ou conta desativada. Consulte o administrador.");
              } catch (caught) { setRequestNotice((caught as Error).message); }
              finally { setRequesting(false); }
            }}>{requesting ? "Enviando…" : "Solicitar acesso"}</button>
            <button
              className="primary"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Verificar acesso novamente
            </button>
            <button onClick={logout}>Sair</button>
          </div>
        </>
      ) : (
        <>
          {error && (
            <p role="alert" className="access-feedback error">
              {error}
            </p>
          )}
          <FirebaseAccess auth={auth} />
        </>
      )}
    </AccessLayout>
  );
}

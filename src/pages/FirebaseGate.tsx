import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import { api, ApiError } from "../services/api";
import { firebaseAuth } from "../services/firebase";
import type { Identity } from "../domain/types";

type Session = { remote: ReturnType<typeof api>; identity: Identity };

function signInError(error: unknown) {
  if (error instanceof ApiError) return error.message;
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case "auth/unauthorized-domain":
      return "Este domínio precisa ser autorizado no Firebase para usar o Google.";
    case "auth/popup-blocked":
      return "Permita a janela do Google ou use e-mail e senha.";
    case "auth/popup-closed-by-user":
      return "Janela do Google fechada.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde e tente novamente.";
    case "auth/network-request-failed":
      return "Falha de rede. Confira a conexão e tente novamente.";
    default:
      return "Não foi possível entrar. Confira os dados e tente novamente.";
  }
}

let authInstance: Auth | undefined;

export default function FirebaseGate({
  children,
}: {
  children: (session: Session, logout: () => void) => ReactNode;
}) {
  const client = useQueryClient();
  const [auth, setAuth] = useState<Auth>();
  const [fatal, setFatal] = useState("");
  const [user, setUser] = useState<User | null>();
  const [authorized, setAuthorized] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checking, setChecking] = useState(false);
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
    setNotice("");
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
            setError(signInError(caught));
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

  async function action(run: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await run();
    } catch (caught) {
      setError(signInError(caught));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) return;
    const password = new FormData(event.currentTarget).get("password");
    if (!resetMode) {
      void action(() =>
        signInWithEmailAndPassword(auth, email.trim(), String(password ?? "")),
      );
      return;
    }
    void action(async () => {
      try {
        await sendPasswordResetEmail(auth, email.trim());
      } catch (caught) {
        if ((caught as { code?: string }).code !== "auth/user-not-found")
          throw caught;
      }
      setNotice(
        "Se o e-mail estiver cadastrado, você receberá o link de recuperação.",
      );
    });
  }

  if (authorized && user) return children(authorized, logout);
  return (
    <main className="sign-in">
      <div className="panel stack">
        <h1>RM Control</h1>
        <p className="muted">Homologação · Operações logísticas</p>
        {fatal ? (
          <p role="alert" className="error">
            {fatal}
          </p>
        ) : user === undefined || checking ? (
          <p role="status">
            Verificando acesso. O servidor pode levar até um minuto para
            iniciar.
          </p>
        ) : user ? (
          <>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <p>
              UID da conta <code className="user-uid">{user.uid}</code>
            </p>
            <div className="actions">
              <button onClick={() => setAttempt((value) => value + 1)}>
                Verificar acesso novamente
              </button>
              <button onClick={logout}>Sair</button>
            </div>
          </>
        ) : (
          <>
            <form className="stack" onSubmit={submit}>
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              {!resetMode && (
                <>
                  <label htmlFor="password">Senha</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </>
              )}
              <button className="primary" disabled={busy}>
                {busy
                  ? "Aguarde…"
                  : resetMode
                    ? "Enviar link de recuperação"
                    : "Entrar"}
              </button>
            </form>
            {!resetMode && (
              <button
                disabled={busy}
                onClick={() => {
                  if (!auth) return;
                  const provider = new GoogleAuthProvider();
                  provider.setCustomParameters({ prompt: "select_account" });
                  void action(() => signInWithPopup(auth, provider));
                }}
              >
                Entrar com Google
              </button>
            )}
            <button
              className="link-button"
              disabled={busy}
              onClick={() => {
                setResetMode(!resetMode);
                setError("");
                setNotice("");
              }}
            >
              {resetMode ? "Voltar ao login" : "Esqueci minha senha"}
            </button>
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
          </>
        )}
      </div>
    </main>
  );
}

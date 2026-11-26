import { useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  type Auth,
} from "@firebase/auth";
import "./access.css";

type Mode = "login" | "register" | "reset";
type FormError = { message: string; recover?: boolean };

const views = {
  login: {
    title: "Entrar",
    description: "Acesso para usuários autorizados.",
    submit: "Entrar",
  },
  register: {
    title: "Criar conta",
    description:
      "Após o cadastro, um administrador precisa liberar seu acesso.",
    submit: "Criar conta",
  },
  reset: {
    title: "Recuperar senha",
    description:
      "Informe o e-mail da conta para receber o link de recuperação.",
    submit: "Enviar link de recuperação",
  },
};

export function AccessLayout({ children }: { children: ReactNode }) {
  return (
    <main className="access">
      <div className="access-shell">
        <div className="access-context">
          <div className="access-brand">
            <span className="access-mark" aria-hidden="true">
              RM
            </span>
            <span>RM Control</span>
          </div>
          <div className="access-context-copy">
            <p className="access-environment">Homologação</p>
            <p className="access-product">
              Operações
              <br />
              logísticas
            </p>
            <p className="access-summary">
              Acompanhe chamados, recebimentos e divergências de inventário.
            </p>
          </div>
          <div className="access-art" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
        <section className="access-content" aria-labelledby="access-title">
          <div className="access-content-inner">{children}</div>
        </section>
      </div>
    </main>
  );
}

function authMessage(code: string | undefined, mode: Mode) {
  switch (code) {
    case "auth/email-already-in-use":
      return "Já existe uma conta com este e-mail. Se você usou o Google antes, volte ao login e escolha Entrar com Google.";
    case "auth/account-exists-with-different-credential":
      return "Entre pelo método que você usou para criar a conta.";
    case "auth/invalid-email":
      return "Confira se o endereço de e-mail está completo.";
    case "auth/operation-not-allowed":
      return "Este método de acesso está indisponível. Tente outra opção na tela de login.";
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
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "Use uma senha mais forte, com letras, números e símbolos.";
    default:
      if (mode === "register")
        return "O cadastro está temporariamente indisponível. Tente novamente em instantes.";
      if (mode === "reset")
        return "Não foi possível solicitar a recuperação de senha. Tente novamente.";
      return "Não foi possível entrar. Confira os dados e tente novamente.";
  }
}

function PasswordField({
  confirmation = false,
  register,
}: {
  confirmation?: boolean;
  register: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const id = confirmation ? "confirm-password" : "password";
  return (
    <div className="access-field">
      <label htmlFor={id}>{confirmation ? "Confirme a senha" : "Senha"}</label>
      <div className="access-password">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          required
          minLength={register ? 6 : undefined}
          maxLength={4096}
          autoComplete={register ? "new-password" : "current-password"}
        />
        <button
          type="button"
          className="access-text-button"
          aria-controls={id}
          aria-label={`${visible ? "Ocultar" : "Mostrar"} ${confirmation ? "confirmação da senha" : "senha"}`}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
    </div>
  );
}

export function FirebaseAccess({ auth }: { auth: Auth }) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [notice, setNotice] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const pending = useRef(false);
  const view = views[mode];

  function changeMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice("");
    form.current?.querySelector<HTMLInputElement>("#email")?.focus();
  }

  async function action(run: () => Promise<unknown>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      await run();
    } catch (caught) {
      const code = (caught as { code?: string } | null)?.code;
      setError({
        message: authMessage(code, mode),
        recover: mode === "register" && code === "auth/email-already-in-use",
      });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    const fields = new FormData(event.currentTarget);
    const password = String(fields.get("password") ?? "");
    if (mode === "register") {
      if (password !== fields.get("confirm-password")) {
        setError({ message: "As senhas precisam ser iguais." });
        form.current
          ?.querySelector<HTMLInputElement>("#confirm-password")
          ?.focus();
        return;
      }
      void action(() =>
        createUserWithEmailAndPassword(auth, address, password),
      );
      return;
    }
    if (mode === "login") {
      void action(() => signInWithEmailAndPassword(auth, address, password));
      return;
    }
    void action(async () => {
      try {
        await sendPasswordResetEmail(auth, address);
      } catch (caught) {
        if ((caught as { code?: string }).code !== "auth/user-not-found")
          throw caught;
      }
      setNotice(
        "Se o e-mail estiver cadastrado, você receberá o link de recuperação.",
      );
    });
  }

  return (
    <>
      <header className="access-heading">
        <h1 id="access-title">{view.title}</h1>
        <p>{view.description}</p>
      </header>
      <form ref={form} className="access-form" onSubmit={submit}>
        <div className="access-field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="nome@exemplo.com"
            maxLength={254}
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError(null);
            }}
          />
        </div>
        {mode !== "reset" && (
          <PasswordField key={mode} register={mode === "register"} />
        )}
        {mode === "register" && <PasswordField confirmation register />}
        {mode === "login" && (
          <button
            type="button"
            className="access-text-button access-reset"
            disabled={busy}
            onClick={() => changeMode("reset")}
          >
            Esqueci minha senha
          </button>
        )}
        {error && (
          <div className="access-feedback error">
            <p role="alert">{error.message}</p>
            {error.recover && (
              <button
                type="button"
                className="access-text-button"
                onClick={() => changeMode("reset")}
              >
                Recuperar senha
              </button>
            )}
          </div>
        )}
        {notice && (
          <p role="status" className="access-feedback notice">
            {notice}
          </p>
        )}
        <button className="primary access-submit" disabled={busy}>
          {busy ? "Aguarde…" : view.submit}
        </button>
      </form>
      {mode === "login" ? (
        <>
          <div className="access-divider">ou</div>
          <button
            className="access-google"
            disabled={busy}
            onClick={() => {
              const provider = new GoogleAuthProvider();
              provider.setCustomParameters({ prompt: "select_account" });
              void action(() => signInWithPopup(auth, provider));
            }}
          >
            Entrar com Google
          </button>
          <div className="access-switch">
            <p>Primeiro acesso?</p>
            <button
              type="button"
              className="access-text-button"
              disabled={busy}
              onClick={() => changeMode("register")}
            >
              Criar conta
            </button>
          </div>
        </>
      ) : (
        <div className="access-switch">
          <button
            type="button"
            className="access-text-button"
            disabled={busy}
            onClick={() => changeMode("login")}
          >
            Voltar ao login
          </button>
        </div>
      )}
    </>
  );
}

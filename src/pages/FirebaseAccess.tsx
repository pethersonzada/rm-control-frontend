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
    description: "Use sua conta para acessar o RM Control.",
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
        <header className="access-brand">
          <img className="access-logo" src="/logo-mono-com-nome.png" alt="RM Control" />
          <p>Recebimento de mercadorias</p>
        </header>
        <section className="access-content" aria-labelledby="access-title">
          <div className="access-content-inner">{children}</div>
        </section>
        <footer className="access-footer">Ambiente de homologação · Use apenas dados fictícios</footer>
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
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.1v5h6.6c3.8-3.5 6.1-8.7 6.1-14.8z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.7l-6.6-5c-1.8 1.2-4.2 1.9-6.9 1.9-5.3 0-9.9-3.6-11.5-8.4H5.7v5.2A20 20 0 0 0 24 44z"/><path fill="#FBBC05" d="M12.5 27.8a12 12 0 0 1 0-7.6V15H5.7a20 20 0 0 0 0 18z"/><path fill="#EA4335" d="M24 11.8c3 0 5.6 1 7.7 3l5.8-5.8A19.2 19.2 0 0 0 24 4 20 20 0 0 0 5.7 15l6.8 5.2c1.6-4.8 6.2-8.4 11.5-8.4z"/></svg>
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

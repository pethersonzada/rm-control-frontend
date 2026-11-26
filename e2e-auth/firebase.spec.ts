import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

function token(sequence: number) {
  const now = Math.floor(Date.now() / 1000);
  const claims = Buffer.from(
    JSON.stringify({ sub: "qa-uid", iat: now, exp: now + 3600 }),
  ).toString("base64url");
  return `eyJhbGciOiJSUzI1NiJ9.${claims}.synthetic${sequence}`;
}

test("entra, renova, restaura sessão, sai e bloqueia UID não autorizado", async ({
  page,
}) => {
  let renewal = 0;
  let accountAllowed = true;
  const disruptions = [0, 503, 429];
  const account = {
    localId: "qa-uid",
    email: "qa@example.invalid",
    emailVerified: true,
    providerUserInfo: [],
  };

  await page.route(
    "https://identitytoolkit.googleapis.com/**",
    async (route) => {
      const endpoint = route.request().url();
      if (endpoint.includes("signInWithPassword"))
        return route.fulfill({
          json: {
            ...account,
            idToken: token(0),
            refreshToken: "qa-refresh",
            expiresIn: "3600",
          },
        });
      if (endpoint.includes("accounts:lookup"))
        return route.fulfill({ json: { users: [account] } });
      if (endpoint.includes("sendOobCode")) {
        expect(route.request().postDataJSON().requestType).toBe(
          "PASSWORD_RESET",
        );
        return route.fulfill({ json: { email: account.email } });
      }
      return route.abort();
    },
  );
  await page.route("https://securetoken.googleapis.com/**", (route) => {
    renewal++;
    return route.fulfill({
      json: {
        access_token: token(renewal),
        refresh_token: "qa-refresh",
        expires_in: "3600",
        user_id: account.localId,
      },
    });
  });
  await page.route("**/api/me", (route) => {
    const disruption = disruptions.shift();
    if (disruption === 0) return route.abort();
    if (disruption) return route.fulfill({ status: disruption, json: {} });
    if (!accountAllowed)
      return route.fulfill({
        status: 403,
        headers: { "X-RM-Account-Denied": "1" },
        json: { detail: "Conta sem autorização para acessar o RM Control." },
      });
    if (!route.request().headers().authorization.endsWith("synthetic1")) {
      return route.fulfill({
        status: 401,
        json: { detail: "Credencial inválida." },
      });
    }
    return route.fulfill({
      json: {
        subject: "qa",
        organization: "qa-org",
        role: "viewer",
        stores: ["2"],
      },
    });
  });
  await page.route("**/api/summary", (route) =>
    route.fulfill({
      json: {
        occurrences: 0,
        items_without_value: 0,
        status_counts: {},
        totals_by_reason: { FALTA: "0.00" },
        net_reported: "0.00",
        approved: null,
        recovered: null,
        pending: null,
        note: "Sintético",
      },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Entrar com Google" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Esqueci minha senha" }).click();
  await page.getByLabel("E-mail").fill(account.email);
  await page
    .getByRole("button", { name: "Enviar link de recuperação" })
    .click();
  await expect(page.getByText(/Se o e-mail estiver cadastrado/)).toBeVisible();
  await page.getByRole("button", { name: "Voltar ao login" }).click();
  async function signIn() {
    await page.getByLabel("E-mail").fill(account.email);
    await page
      .getByLabel("Senha", { exact: true })
      .fill("senha-sintetica-para-teste");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
  }
  await signIn();
  const retry = page.getByRole("button", {
    name: "Verificar acesso novamente",
  });
  await expect(page.getByRole("alert")).toContainText(
    "Falha de conexão com a API",
  );
  await retry.click();
  await expect(page.getByRole("alert")).toContainText(
    "O servidor está iniciando",
  );
  await retry.click();
  await expect(page.getByRole("alert")).toContainText("Muitas requisições");
  await retry.click();
  await expect(
    page.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
  expect(renewal).toBe(1);
  await expect(page.getByRole("link", { name: "Usuários" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Importar dados" })).toHaveCount(
    0,
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeVisible();
  accountAllowed = false;
  await signIn();
  await expect(page.getByRole("alert")).toHaveText(
    "Conta sem autorização para acessar o RM Control.",
  );
  await expect(page.getByText(account.localId)).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
});

test("cadastra conta e mantém a área operacional bloqueada até liberação", async ({
  page,
}) => {
  const account = {
    localId: "qa-uid",
    email: "cadastro@example.invalid",
    emailVerified: false,
  };
  let signups = 0;

  await page.route("https://identitytoolkit.googleapis.com/**", (route) => {
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint.endsWith("accounts:signUp")) {
      signups++;
      expect(route.request().postDataJSON()).toMatchObject({
        email: account.email,
        password: "sintetica-123",
        returnSecureToken: true,
      });
      return route.fulfill({
        json: {
          ...account,
          idToken: token(0),
          refreshToken: "qa-refresh",
          expiresIn: "3600",
        },
      });
    }
    if (endpoint.endsWith("accounts:lookup")) {
      return route.fulfill({ json: { users: [account] } });
    }
    return route.abort();
  });
  await page.route("**/api/me", (route) => {
    expect(route.request().headers().authorization).toBeDefined();
    return route.fulfill({
      status: 403,
      headers: { "X-RM-Account-Denied": "1" },
      json: { detail: "Conta sem autorização para acessar o RM Control." },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Criar conta" }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);

  await page.getByLabel("E-mail", { exact: true }).fill(account.email);
  await page.getByLabel("Senha", { exact: true }).fill("sintetica-123");
  await page
    .getByRole("button", { name: "Mostrar senha", exact: true })
    .click();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByRole("button", { name: "Ocultar senha", exact: true })
    .click();
  await page.getByLabel("Confirme a senha").fill("diferente-123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "As senhas precisam ser iguais.",
  );
  expect(signups).toBe(0);

  await page.getByLabel("Confirme a senha").fill("sintetica-123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Acesso pendente" }),
  ).toBeVisible();
  await expect(page.getByText(account.localId)).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  expect(signups).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Acesso pendente" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.getByRole("button", { name: "Criar conta" })).toBeVisible();
});

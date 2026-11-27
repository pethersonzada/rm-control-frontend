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

test("explica a recusa no cadastro e oferece recuperação sem reenviar o formulário", async ({
  page,
}) => {
  const email = "conta-existente@example.invalid";
  const failures = ["WEAK_PASSWORD : Password is too weak", "EMAIL_EXISTS"];
  let recoveryRequests = 0;
  await page.route("https://identitytoolkit.googleapis.com/**", (route) => {
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint.endsWith("accounts:signUp")) {
      return route.fulfill({
        status: 400,
        json: { error: { message: failures.shift() } },
      });
    }
    if (endpoint.endsWith("accounts:sendOobCode")) {
      recoveryRequests++;
      expect(route.request().postDataJSON()).toMatchObject({
        email,
        requestType: "PASSWORD_RESET",
      });
      return route.fulfill({ json: { email } });
    }
    return route.abort();
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("sintetica-123");
  await page
    .getByLabel("Confirme a senha", { exact: true })
    .fill("sintetica-123");
  const submit = page.getByRole("button", { name: "Criar conta", exact: true });
  await submit.click();
  await expect(page.getByRole("alert")).toContainText(
    "Use uma senha mais forte",
  );
  await submit.click();
  await expect(page.getByRole("alert")).toContainText("Já existe uma conta");
  await page
    .getByRole("button", { name: "Recuperar senha", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Recuperar senha" }),
  ).toBeVisible();
  await expect(page.getByLabel("E-mail", { exact: true })).toHaveValue(email);
  await expect(page.getByLabel("Senha", { exact: true })).toHaveCount(0);
  expect(recoveryRequests).toBe(0);
  await page
    .getByRole("button", { name: "Enviar link de recuperação" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Se o e-mail estiver cadastrado",
  );
  expect(recoveryRequests).toBe(1);
});


test("administrador cria loja, aprova conta, registra chamado e gera XLSX", async ({page}) => {
  const account = {localId:"qa-uid",email:"owner@example.invalid",emailVerified:true};
  const stores = [{code:"2",name:"Loja sintética",active:true}];
  const requests = [{uid:"pending-test",status:"pending",created_at:"2026-11-25T00:00:00Z"}];
  const members: Array<Record<string, unknown>> = [];
  const records: Array<Record<string, unknown>> = [];
  const products: Array<Record<string, unknown>> = [];
  await page.route("https://identitytoolkit.googleapis.com/**", route => {
    if (route.request().url().includes("signInWithPassword")) return route.fulfill({json:{...account,idToken:token(0),refreshToken:"qa-refresh",expiresIn:"3600"}});
    if (route.request().url().includes("accounts:lookup")) return route.fulfill({json:{users:[account]}});
    return route.abort();
  });
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname.replace("/api","");
    const method = route.request().method();
    expect(route.request().headers().authorization).toBeDefined();
    if(path==="/me")return route.fulfill({json:{subject:"qa",organization:"qa-org",role:"admin",stores:stores.filter(s=>s.active).map(s=>s.code),can_delegate_admin:true}});
    if(path==="/summary")return route.fulfill({json:{occurrences:records.length,items_without_value:0,status_counts:{},totals_by_reason:{FALTA:"0"},net_reported:"0",approved:null,recovered:null,pending:null,note:"Sintético"}});
    if(path==="/catalog")return route.fulfill({json:{products,next_cursor:null}});
    if(path==="/admin/catalog"&&method==="PUT"){products.push(route.request().postDataJSON());return route.fulfill({json:products.at(-1)});}
    if(path.endsWith("/history"))return route.fulfill({json:{events:[{action:"ticket.create",subject:"qa",previous_status:null,next_status:"PENDENTE",created_at:"2026-11-25T12:00:00Z",details:{revision:1,fields:["creation"]}}],next_cursor:null}});
    if(path==="/imports/preview")return route.fulfill({json:{records:[{code:"001",destination:"7",origin:"CD QA",load:"1",reason:"FALTA",status:"PENDENTE",items:[],expected_snapshot:"absent"}],warnings:[],comparison:{new:1,updated:0,unchanged:0,conflicts:0},classifications:[{code:"001",destination:"7",state:"new"}],blocked:false}});
    if(path==="/imports/confirm"){expect(route.request().postDataJSON()[0].expected_snapshot).toBe("absent");return route.fulfill({json:{saved:1,replayed:false}});}
    if(path==="/stores")return route.fulfill({json:stores});
    if(path==="/admin/stores"&&method==="PUT"){stores.push(route.request().postDataJSON());return route.fulfill({json:stores.at(-1)});}
    if(path==="/admin/access-requests")return route.fulfill({json:requests});
    if(path==="/admin/users"&&method==="GET")return route.fulfill({json:members});
    if(path==="/admin/users"&&method==="PUT"){const member=route.request().postDataJSON();members.push(member);requests.splice(0);return route.fulfill({json:member});}
    if(path==="/tickets"&&method==="POST"){
      const data=route.request().postDataJSON();
      expect(data.destination).toBe("7");
      expect(data.items[0].code).toBe("000123");
      expect(route.request().headers()["idempotency-key"]).toBeTruthy();
      const record={...data,code:"9000000000000000000000000000000000000001",status:"PENDENTE",received_at:"25/11/2026",source:"native",revision:1};
      records.push(record);return route.fulfill({json:record});
    }
    if(path==="/occurrences")return route.fulfill({json:{records,next_cursor:null}});
    if(path==="/reports/chamados.xlsx")return route.fulfill({body:Buffer.from("synthetic-workbook"),contentType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    return route.fulfill({status:404,json:{detail:"Rota sintética não encontrada"}});
  });
  await page.goto("/");
  await page.getByLabel("E-mail",{exact:true}).fill(account.email);
  await page.getByLabel("Senha",{exact:true}).fill("senha-sintetica");
  await page.getByRole("button",{name:"Entrar",exact:true}).click();
  await page.getByRole("link",{name:"Lojas",exact:true}).click();
  await page.getByLabel("Código da loja").fill("7");
  await page.getByLabel("Nome da loja").fill("Loja QA");
  await page.getByRole("button",{name:"Salvar loja"}).click();
  await expect(page.getByRole("cell",{name:"Loja QA"})).toBeVisible();
  await page.getByRole("link",{name:"Usuários"}).click();
  await page.getByRole("button",{name:"Definir permissões"}).click();
  await page.getByLabel("Perfil").selectOption("importer");
  await page.getByLabel("7 · Loja QA").check();
  await page.getByRole("button",{name:"Salvar permissões"}).click();
  await expect(page.getByText("Nenhuma solicitação pendente.")).toBeVisible();
  await page.getByRole("link",{name:"Catálogo",exact:true}).click();
  await page.getByLabel("PLU",{exact:true}).fill("000123");
  await page.getByLabel("Descrição",{exact:true}).fill("Produto QA");
  await page.getByLabel("Embalagem",{exact:true}).fill("CX");
  await page.getByLabel("Referência conferida").fill("Catálogo sintético");
  await page.getByRole("button",{name:"Salvar produto"}).click();
  await expect(page.getByRole("cell",{name:"Produto QA"})).toBeVisible();
  await page.getByRole("link",{name:"Importar dados"}).click();
  await page.getByLabel("Listagem e detalhes copiados").fill("Amostra sintética");
  await page.getByRole("button",{name:"Analisar dados"}).click();
  await expect(page.getByText("Novos",{exact:true})).toBeVisible();
  await page.getByLabel("Revisei a prévia e autorizo a gravação").check();
  await page.getByRole("button",{name:"Confirmar importação"}).click();
  await expect(page.getByText("1 chamado(s) salvo(s).")).toBeVisible();
  await expect(page.getByLabel("Listagem e detalhes copiados")).toHaveValue("");
  await page.getByRole("link",{name:"Chamados",exact:true}).click();
  await page.getByRole("link",{name:"Novo chamado"}).click();
  await page.getByLabel("Loja",{exact:true}).selectOption("7");
  await page.getByLabel("Data de recebimento").fill("2026-11-25");
  await page.getByLabel("Tipo de divergência").selectOption("FALTA");
  await page.getByLabel("PLU",{exact:true}).fill("000123");
  await page.getByRole("button",{name:"Buscar PLU no catálogo"}).click();
  await expect(page.getByLabel("Descrição",{exact:true})).toHaveValue("Produto QA");
  await expect(page.getByLabel("Embalagem / volume")).toHaveValue("CX");
  await page.getByLabel("Quantidade divergente").fill("2");
  await page.getByLabel("Valor total informado (R$)").fill("12,34");
  await page.getByRole("button",{name:"Salvar chamado"}).click();
  await expect(page.getByRole("heading",{name:"Chamado registrado"})).toBeVisible();
  await page.getByRole("button",{name:"Voltar aos chamados"}).click();
  await expect(page.getByText("1 chamado(s) nesta página.")).toBeVisible();
  await page.getByRole("button",{name:/RM 0000000001/}).click();
  await expect(page.getByRole("heading",{name:"Histórico do chamado"})).toBeVisible();
  await expect(page.getByText("Chamado criado",{exact:true})).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button",{name:"Gerar planilha Excel"}).click();
  expect((await download).suggestedFilename()).toBe("rm-control-chamados.xlsx");
});

const operational = new URL(
  process.argv[2] || "https://rm-control-frontend.vercel.app",
);
const api = new URL(process.argv[3] || "https://rm-control-api-homologacao.onrender.com");

async function check(origin, path, expected) {
  const response = await fetch(new URL(path, origin), {
    redirect: "manual",
    signal: AbortSignal.timeout(90_000),
  });
  if (!expected.includes(response.status))
    throw new Error(`${response.url} returned ${response.status}`);
  return response;
}

const page = await check(operational, "/", [200]);
if (
  !page.headers.get("content-security-policy")?.includes(api.origin)
)
  throw new Error("CSP operacional não autoriza a API esperada");
const health = await check(operational, "/api/health", [200]);
if ((await health.json()).data === "browser-only") throw new Error("Domínio operacional ainda publica a demo");
for(const path of ["/chamados","/chamados/novo","/fornecedores","/configuracoes"]) await check(operational,path,[200]);
await check(api, "/health", [200]);
await check(api, "/ready", [200]);
await check(api, "/occurrences", [401]);
await check(api, "/supplier-checks", [401]);
console.log("Domínio operacional, rotas diretas, API pronta e acesso anônimo bloqueado. Login real deve ser validado separadamente.");

const demo = new URL(
  process.argv[2] || "https://rm-control-frontend.vercel.app",
);
const api = new URL(process.argv[3] || "https://rm-control-backend.vercel.app");

async function check(origin, path, expected) {
  const response = await fetch(new URL(path, origin), {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  if (!expected.includes(response.status))
    throw new Error(`${response.url} returned ${response.status}`);
  return response;
}

const page = await check(demo, "/", [200]);
if (
  !page.headers.get("content-security-policy")?.includes("connect-src 'none'")
)
  throw new Error("CSP da demo ausente");
const health = await check(demo, "/api/health", [200]);
if ((await health.json()).data !== "browser-only")
  throw new Error("A demo depende do backend");
await check(demo, "/chamados", [200]);
await check(api, "/health", [200]);
await check(api, "/ready", [503]);
await check(api, "/occurrences", [503]);
console.log("Demo pública, rotas diretas e API operacional desativada.");

import { writeFile } from "node:fs/promises";

await writeFile("homologacao/dist/health.json", '{"status":"ok","environment":"homologacao"}\n');

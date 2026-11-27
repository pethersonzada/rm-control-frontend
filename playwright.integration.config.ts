import {defineConfig,devices} from "@playwright/test";
export default defineConfig({
  testDir:"e2e-integration",workers:1,timeout:120_000,
  use:{baseURL:"http://127.0.0.1:4175",...devices["Desktop Chrome"]},
  webServer:{command:"npm run preview -- --outDir homologacao/dist --port 4175 --strictPort",url:"http://127.0.0.1:4175",reuseExistingServer:false},
});

import { defineConfig, devices } from "@playwright/test";

const browser = process.env.RM_CHROMIUM_PATH;
const baseURL = "http://127.0.0.1:4174";
export default defineConfig({
  testDir: "e2e-auth",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    launchOptions: browser
      ? { executablePath: browser, args: ["--no-sandbox"] }
      : {},
  },
  webServer: {
    command:
      "npm run preview -- --outDir homologacao/dist --port 4174 --strictPort",
    url: baseURL,
    reuseExistingServer: false,
  },
});

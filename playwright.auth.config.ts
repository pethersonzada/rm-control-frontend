import { defineConfig, devices } from "@playwright/test";

const browser = process.env.RM_CHROMIUM_PATH;
const baseURL = "http://127.0.0.1:4174";
export default defineConfig({
  testDir: "e2e-auth",
  use: {
    baseURL,
    launchOptions: browser
      ? { executablePath: browser, args: ["--no-sandbox"] }
      : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command:
      "npm run preview -- --outDir homologacao/dist --port 4174 --strictPort",
    url: baseURL,
    reuseExistingServer: false,
  },
});

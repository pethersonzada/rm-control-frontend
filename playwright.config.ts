import { defineConfig, devices } from "@playwright/test";

const url = process.env.RM_TEST_URL || "http://127.0.0.1:4173";
const executable = process.env.RM_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: url,
    launchOptions: executable
      ? { executablePath: executable, args: ["--no-sandbox"] }
      : {},
  },
  webServer: process.env.RM_TEST_URL
    ? undefined
    : {
        command: "npm run preview -- --port 4173 --strictPort",
        url,
        reuseExistingServer: false,
      },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PWA_BASE_URL ?? "http://127.0.0.1:4173";
const previewPort = new URL(baseURL).port || "4173";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/pwa-offline.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    serviceWorkers: "allow",
    trace: "on-first-retry",
  },
  webServer: {
    command: `pnpm preview -- --host 127.0.0.1 --port ${previewPort} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium-pwa", use: { ...devices["Desktop Chrome"] } }],
  workers: 1,
});

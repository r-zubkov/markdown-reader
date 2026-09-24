import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.APP_BASE_URL ?? "http://127.0.0.1:5173";
const devPort = new URL(baseURL).port || "5173";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/pwa-offline.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Import/Worker scenarios are intentionally serialized so the release gate
  // measures product behavior instead of host CPU contention.
  workers: 1,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `pnpm dev -- --host 127.0.0.1 --port ${devPort} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

import { defineConfig, devices } from "@playwright/test";

const port = 3002;
const baseURL = `http://127.0.0.1:${port}`;
const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:5001";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: ["auth-fullstack.spec.ts", "auth-negative.spec.ts"],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${port}`,
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_API_URL: apiUrl,
    },
  },
});

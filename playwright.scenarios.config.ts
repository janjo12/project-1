import { defineConfig, devices } from "@playwright/test";

const scenarioPort = Number(process.env.PLAYWRIGHT_PORT ?? 3127);

export default defineConfig({
  testDir: "./tests/scenarios",
  testMatch: "**/*.spec.ts",
  testIgnore: "**/emulator/**",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    browserName: "chromium",
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    baseURL: `http://127.0.0.1:${scenarioPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run web:visual-server -- --hostname 127.0.0.1 --port ${scenarioPort}`,
    url: `http://127.0.0.1:${scenarioPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

import { defineConfig, devices } from "@playwright/test";

const visualPort = Number(process.env.PLAYWRIGHT_PORT ?? 3127);

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.spec.ts",
  testIgnore: "**/emulator/**",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    browserName: "chromium",
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    baseURL: `http://127.0.0.1:${visualPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run web:visual-server -- --hostname 127.0.0.1 --port ${visualPort}`,
    url: `http://127.0.0.1:${visualPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});




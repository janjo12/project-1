import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./visual-tests",
  fullyParallel: false,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    channel: "msedge",
    baseURL: "http://127.0.0.1:3127",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run web:visual-server -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3127",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});




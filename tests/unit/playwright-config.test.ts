import config from "../../playwright.config";

describe("browser test configuration", () => {
  it("discovers visual and complex end-to-end specs from the shared tests folder", () => {
    expect(config.testDir).toBe("./tests");
    expect(config.testMatch).toContain("**/*.spec.ts");
    expect(config.testIgnore).toBe("**/emulator/**");
  });

  it("uses Playwright-managed Chromium by default instead of requiring installed Edge", () => {
    expect(config.use?.channel).toBeUndefined();
    expect(config.use?.browserName).toBe("chromium");
  });

  it("reuses a local visual server but always starts a fresh CI server", () => {
    const webServer = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;
    expect(webServer?.reuseExistingServer).toBe(!process.env.CI);
  });
});

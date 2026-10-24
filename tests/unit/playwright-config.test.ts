import config from "../../playwright.config";
import scenarioConfig from "../../playwright.scenarios.config";

describe("browser test configuration", () => {
  it("keeps the default browser gate focused and scenarios separately selectable", () => {
    expect(config.testDir).toBe("./tests/browser");
    expect(config.testMatch).toContain("**/*.spec.ts");
    expect(config.workers).toBe(1);
    expect(scenarioConfig.testDir).toBe("./tests/scenarios");
    expect(scenarioConfig.testMatch).toBe("**/*.spec.ts");
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

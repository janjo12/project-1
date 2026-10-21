import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const playwrightCli = resolve(projectRoot, "node_modules/playwright/cli.js");
const preferredPort = Number(process.env.PLAYWRIGHT_PORT ?? 3127);
const playwrightArgs = process.argv.slice(2);

if (!Number.isInteger(preferredPort) || preferredPort < 1 || preferredPort > 65535) {
  console.error(`PLAYWRIGHT_PORT must be a TCP port between 1 and 65535; received ${process.env.PLAYWRIGHT_PORT}.`);
  process.exit(1);
}

if (playwrightArgs[0] === "test") {
  const installCode = await runPlaywrightCommand(["install", "chromium"]);
  if (installCode !== 0) process.exit(installCode);
}

const availablePreferredPort = await claimAndReleasePort(preferredPort);
const port = availablePreferredPort ?? await claimAndReleasePort(0);

if (availablePreferredPort === null) {
  console.log(`Port ${preferredPort} is already in use; using available port ${port} for Playwright.`);
}

const child = spawn(process.execPath, [playwrightCli, ...playwrightArgs], {
  cwd: projectRoot,
  env: { ...process.env, PLAYWRIGHT_PORT: String(port) },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Could not start Playwright: ${error.message}`);
  process.exitCode = 1;
});

child.on("close", (code, signal) => {
  if (signal) {
    console.error(`Playwright was stopped by ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});

function claimAndReleasePort(requestedPort) {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolvePort(null);
      } else {
        reject(error);
      }
    });
    server.listen(requestedPort, "127.0.0.1", () => {
      const { port: claimedPort } = server.address();
      server.close((error) => {
        if (error) reject(error);
        else resolvePort(claimedPort);
      });
    });
  });
}

function runPlaywrightCommand(args) {
  return new Promise((resolveCode) => {
    const child = spawn(process.execPath, [playwrightCli, ...args], {
      cwd: projectRoot,
      stdio: "inherit",
    });
    child.on("error", (error) => {
      console.error(`Could not run Playwright ${args[0]}: ${error.message}`);
      resolveCode(1);
    });
    child.on("close", (code, signal) => {
      if (signal) {
        console.error(`Playwright ${args[0]} was stopped by ${signal}.`);
        resolveCode(1);
        return;
      }
      resolveCode(code ?? 1);
    });
  });
}

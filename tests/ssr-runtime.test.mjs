import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = process.cwd();
const nextCli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));

test("production SSR renders the home page without a missing requestAnimationFrame", async () => {
  const port = await getAvailablePort();
  const server = spawn(process.execPath, [nextCli, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: projectRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  server.stdout.setEncoding("utf8").on("data", chunk => { output += chunk; });
  server.stderr.setEncoding("utf8").on("data", chunk => { output += chunk; });

  try {
    const response = await waitForResponse(`http://127.0.0.1:${port}/`, server, () => output);
    const html = await response.text();

    assert.equal(response.status, 200, `SSR returned HTTP ${response.status}. Server output:\n${output}`);
    assert.match(html, /<html/);

    // Give Next time to flush exceptions raised while rendering the request.
    await delay(100);
    assert.doesNotMatch(output, /requestAnimationFrame is not defined/);
    assert.doesNotMatch(output, /uncaughtException/);
  } finally {
    server.kill();
  }
});

async function getAvailablePort() {
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("Could not allocate a local test port.");
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function waitForResponse(url, server, getOutput) {
  const deadline = Date.now() + 30_000;
  let lastError;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Next exited before becoming ready. Server output:\n${getOutput()}`);
    try {
      return await fetch(url);
    } catch (error) {
      lastError = error;
      await delay(200);
    }
  }

  throw new Error(`Next did not become ready: ${lastError}. Server output:\n${getOutput()}`);
}

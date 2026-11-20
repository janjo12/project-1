import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

async function getAvailablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

test("Next dev serves the homepage from an isolated dev output directory", async () => {
  const port = await getAvailablePort();
  const distDir = `.next-dev-smoke-${process.pid}-${randomUUID()}`;
  const distPath = path.resolve(projectRoot, distDir);
  const nextEnvPath = path.resolve(projectRoot, "next-env.d.ts");
  const originalNextEnv = await readFile(nextEnvPath);
  const child = spawn(process.execPath, [
    "node_modules/next/dist/bin/next", "dev", "--port", String(port), "--webpack",
  ], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: "development",
      NEXT_DIST_DIR: distDir,
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.setEncoding("utf8").on("data", chunk => { output += chunk; });
  child.stderr.setEncoding("utf8").on("data", chunk => { output += chunk; });
  const onExit = new Promise(resolve => child.once("exit", (code, signal) => resolve({ code, signal })));

  try {
    const deadline = Date.now() + 120_000;
    let response;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) break;
      try {
        response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(5_000) });
        if (response.ok) break;
        if (output.includes("required-server-files.json")) break;
      } catch {
        // The dev server is still starting or compiling its first request.
      }
      await delay(250);
    }

    assert.ok(response?.ok, `Next dev did not serve the homepage. Output:\n${output}`);
    assert.doesNotMatch(output, /required-server-files\.json/);
  } finally {
    child.kill();
    await Promise.race([onExit, delay(5_000)]);
    await rm(distPath, { recursive: true, force: true });
    await writeFile(nextEnvPath, originalNextEnv);
  }
});

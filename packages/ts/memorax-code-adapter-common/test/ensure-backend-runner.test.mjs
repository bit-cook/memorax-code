import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { backendTokenPath, writeBackendConnectionAuthority, writeBackendTokenRecord } from "../src/backend-connection.mjs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  DEFAULT_ENSURE_BACKEND_START_TIMEOUT_MS,
  ensureBackendAvailable,
} from "../src/hooks/ensure-backend-runner.mjs";

test("ensure-backend process ceiling leaves room for lifecycle lock wait and recovery", () => {
  assert.equal(DEFAULT_ENSURE_BACKEND_START_TIMEOUT_MS, 90000);
});

test("shared Backend recovery passes caller-supplied internal environment", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "memorax-code-ensure-runner-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const memoraxCodeHome = join(root, "memorax-code-home");
  await mkdir(memoraxCodeHome, { recursive: true });
  const recordPath = join(root, "recovery.json");
  const command = join(root, "recovery-memorax-code.mjs");
  await writeFile(command, [
    'import { writeFileSync } from "node:fs";',
    'writeFileSync(process.env.MEMORAX_CODE_TEST_RECORD_PATH, JSON.stringify({',
    '  marker: process.env.MEMORAX_CODE_DSH_ADAPTER_RECOVERY,',
    '  revision: process.env.MEMORAX_CODE_DSH_ADAPTER_EXPECTED_REVISION,',
    '}));',
  ].join("\n"));

  await ensureBackendAvailable({
    backendConnection: {
      memoraxCodeHome,
      url: "http://127.0.0.1:9",
      source: "environment",
    },
    healthTimeoutValue: "50",
    memoraxCodeCommand: command,
    nodePath: process.execPath,
    resolveHomes: () => ({ memoraxCodeHome }),
    buildStartArgs: () => ["start"],
    recoveryEnv: {
      MEMORAX_CODE_TEST_RECORD_PATH: recordPath,
      MEMORAX_CODE_DSH_ADAPTER_RECOVERY: "1",
      MEMORAX_CODE_DSH_ADAPTER_EXPECTED_REVISION: "revision-1",
    },
  });

  assert.deepEqual(JSON.parse(await readFile(recordPath, "utf8")), {
    marker: "1",
    revision: "revision-1",
  });
});

test("concurrent client Hooks share one recovery and refresh its rotated connection token", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "memorax-code-concurrent-recovery-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const memoraxCodeHome = join(root, "memorax-code-home");
  let starts = 0;
  let healthy = false;
  const initialHealthResponses = [];
  const turns = new Set();
  const server = createServer(async (request, response) => {
    let text = "";
    for await (const chunk of request) text += chunk;
    if (request.url === "/health") {
      if (!healthy && initialHealthResponses.length < 2) {
        initialHealthResponses.push(response);
        if (initialHealthResponses.length === 2) {
          for (const pending of initialHealthResponses) pending.writeHead(503).end();
        }
        return;
      }
      const authorized = healthy && request.headers["x-memorax-code-backend-token"] === "rotated-token";
      response.writeHead(authorized ? 200 : 503, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: authorized, service: "memorax-code-backend" }));
      return;
    }
    if (request.url === "/start") {
      starts += 1;
      turns.clear();
      writeBackendTokenRecord({ memoraxCodeHome, token: "rotated-token", createdAt: new Date().toISOString() });
      healthy = true;
      response.end("started");
      return;
    }
    if (request.url === "/memory/turn-start") {
      const authorized = healthy && request.headers["x-memorax-code-backend-token"] === "rotated-token";
      if (authorized) turns.add(JSON.parse(text).client);
      response.writeHead(authorized ? 200 : 401).end();
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  writeBackendTokenRecord({ memoraxCodeHome, token: "initial-token", createdAt: new Date().toISOString() });
  writeBackendConnectionAuthority({ memoraxCodeHome, url, tokenPath: backendTokenPath(memoraxCodeHome) });
  const command = join(root, "recover.mjs");
  await writeFile(command, `await fetch(${JSON.stringify(`${url}/start`)}, { method: "POST" });\n`);
  const hook = join(root, "hook.mjs");
  await writeFile(hook, `
import { ensureBackendAvailable } from ${JSON.stringify(new URL("../src/hooks/ensure-backend-runner.mjs", import.meta.url).href)};
import { resolveBackendConnection } from ${JSON.stringify(new URL("../src/backend-connection.mjs", import.meta.url).href)};
const client = process.argv[2];
const memoraxCodeHome = ${JSON.stringify(memoraxCodeHome)};
const connection = resolveBackendConnection({ memoraxCodeHome });
if (client === "claude") connection.source = "option";
await ensureBackendAvailable({
  backendConnection: connection,
  healthTimeoutValue: "3000",
  startTimeoutValue: "10000",
  memoraxCodeCommand: ${JSON.stringify(command)},
  resolveHomes: () => ({ memoraxCodeHome }),
  buildStartArgs: () => ["start"],
});
const current = resolveBackendConnection({ memoraxCodeHome });
const response = await fetch(new URL("/memory/turn-start", current.url), {
  method: "POST",
  headers: { "x-memorax-code-backend-token": current.token, "content-type": "application/json" },
  body: JSON.stringify({ client }),
});
if (!response.ok) throw new Error("turn start was rejected");
`);
  const env = {
    ...process.env,
    MEMORAX_CODE_HOME: memoraxCodeHome,
    MEMORAX_CODE_BACKEND_URL: "",
    MEMORAX_CODE_BACKEND_HOST: "",
    MEMORAX_CODE_BACKEND_PORT: "",
    MEMORAX_CODE_BACKEND_TOKEN: "",
  };
  const children = ["codex", "claude"].map((client) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [hook, client], { env, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stderr }));
  }));
  for (const result of await Promise.all(children)) assert.equal(result.code, 0, result.stderr);
  assert.equal(starts, 1);
  assert.deepEqual([...turns].sort(), ["claude", "codex"]);
});

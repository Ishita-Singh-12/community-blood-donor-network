import { spawn } from "node:child_process";
import net from "node:net";
const port = await new Promise((resolve) => {
  const server = net.createServer().listen(0, "127.0.0.1", () => {
    const p = server.address().port;
    server.close(() => resolve(p));
  });
});
const env = {
  ...process.env,
  PORT: String(port),
  HOST: "127.0.0.1",
  TEST_URL: `http://127.0.0.1:${port}`,
};
delete env.MONGODB_URI;
env.NODE_ENV = "test";
env.CLIENT_ORIGIN = "http://localhost:5173";
const backend = spawn(process.execPath, ["server/index.js"], {
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
backend.stdout.on("data", (d) => (logs += d));
backend.stderr.on("data", (d) => (logs += d));
try {
  let ready = false;
  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch(env.TEST_URL + "/api/health");
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!ready) throw new Error(`Test server did not start: ${logs}`);
  const args = process.argv.includes("--ui")
    ? ["tests/ui.mjs"]
    : [
        "--test",
        "--test-concurrency=1",
        "tests/api.test.js",
        "tests/matching.test.js",
        "tests/assistant.test.js",
      ];
  const code = await new Promise((resolve) =>
    spawn(process.execPath, args, { env, stdio: "inherit" }).on(
      "exit",
      resolve,
    ),
  );
  process.exitCode = code || 0;
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  backend.kill("SIGTERM");
  await new Promise((resolve) => backend.on("exit", resolve));
}

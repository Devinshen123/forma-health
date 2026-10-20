import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createApp } from "./app";

const workspace = fileURLToPath(new URL("../", import.meta.url));
// Local defaults stay local. Production must explicitly provide its listener,
// persistent private data directory and trusted reverse-proxy hop count.
function integer(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`Invalid ${name}`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
  return value;
}
const port = integer('PORT', 3001, 1, 65535);
const host = process.env.HOST || '127.0.0.1';
const service = createApp({
  dataDir: resolve(process.env.FORMA_DATA_DIR || resolve(workspace, "data")),
  distDir: resolve(workspace, "dist"),
  trustProxy: integer('FORMA_TRUST_PROXY_HOPS', 0, 0, 3),
});
const server = service.app.listen(port, host, () => {
  console.log(`FORMA server listening on ${host}:${port}`);
});
let stopping = false;
const shutdown = () => {
  if (stopping) return;
  stopping = true;
  server.close(() => {
    service.close();
    process.exit(0);
  });
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

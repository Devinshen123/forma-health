import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createApp } from "./app";

const workspace = fileURLToPath(new URL("../", import.meta.url));
const service = createApp({
  dataDir: resolve(workspace, "data"),
  distDir: resolve(workspace, "dist"),
});
const server = service.app.listen(3001, "127.0.0.1", () => {
  console.log("FORMA local server: http://127.0.0.1:3001");
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

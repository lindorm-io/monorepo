import { Logger } from "@lindorm/logger";
import { LindormWorker } from "../src/index.js";

const logger = new Logger({ level: "info", readable: true });

const worker = new LindormWorker({
  alias: "publish-outbox",
  interval: "1m",
  callbackTimeout: "10s",
  logger,

  retry: {
    strategy: "exponential",
    maxAttempts: 3,
    timeout: 250,
    timeoutMax: 5_000,
  },

  listeners: [
    { event: "start", listener: () => logger.info("outbox worker started") },
    { event: "warning", listener: (error) => logger.warn("attempt failed", error) },
  ],

  callback: async () => {
    throw new Error("broker unreachable");
  },

  errorCallback: async (ctx, error) => {
    ctx.logger.error("outbox left unpublished", error);
  },
});

worker.on("error", (error) => logger.error("retries exhausted", error));
worker.once("success", () => logger.info("outbox drained"));

worker.start();

await worker.stop();
await worker.destroy();

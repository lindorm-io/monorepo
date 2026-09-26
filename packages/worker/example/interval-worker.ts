// @lindorm/logger is a peer dependency — install it alongside @lindorm/worker.
import { Logger } from "@lindorm/logger";
import { LindormWorker } from "../src/index.js";

const logger = new Logger({ level: "info", readable: true });

const worker = new LindormWorker({
  alias: "cleanup",
  interval: "10m",
  jitter: "30s",
  logger,

  callback: async (ctx) => {
    ctx.logger.info("deleting expired rows", { seq: ctx.seq });
  },
});

worker.start();

await worker.trigger();

console.log("alias         > ", worker.alias);
console.log("seq           > ", worker.seq);
console.log("nextRun       > ", worker.nextRun);
console.log("latestSuccess > ", worker.latestSuccess);
console.log("health        > ", worker.health());

await worker.stop();
await worker.destroy();

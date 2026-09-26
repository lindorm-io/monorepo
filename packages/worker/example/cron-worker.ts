import { Logger } from "@lindorm/logger";
import { LindormWorker } from "../src/index.js";

const logger = new Logger({ level: "info", readable: true });

const worker = new LindormWorker({
  alias: "nightly-report",
  cron: "0 2 * * *",
  timezone: "Europe/Stockholm",
  jitter: "1m",
  logger,

  callback: async (ctx) => {
    ctx.logger.info("generating nightly report", { seq: ctx.seq });
  },
});

worker.start();

console.log("started > ", worker.started);
console.log("nextRun > ", worker.nextRun);

await worker.stop();

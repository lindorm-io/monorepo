import { Logger } from "@lindorm/logger";
import { LindormWorker } from "../../src/index.js";

export default new LindormWorker({
  alias: "SessionWorker",
  interval: "30s",
  logger: new Logger({ level: "info", readable: true }),

  callback: async (ctx) => {
    ctx.logger.info("pruning dead sessions");
  },
});

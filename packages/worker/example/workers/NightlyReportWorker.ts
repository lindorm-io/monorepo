import type { LindormWorkerCallback } from "../../src/index.js";

export const CALLBACK: LindormWorkerCallback = async (ctx) => {
  ctx.logger.info("generating nightly report");
};

export const CRON = "0 2 * * *";

export const TIMEZONE = "Europe/Stockholm";

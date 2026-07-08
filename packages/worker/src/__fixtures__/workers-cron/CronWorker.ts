import type { LindormWorkerCallback } from "../../types/index.js";

export const CALLBACK: LindormWorkerCallback = async (ctx) => {
  ctx.logger.debug("Hello world");
};

export const CRON = "0 0 * * *";

export const TIMEZONE = "Europe/Stockholm";

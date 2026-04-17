import type { LindormWorkerCallback } from "@lindorm/worker";

export const CALLBACK: LindormWorkerCallback = async (ctx) => {
  ctx.logger.info("I'm alive");
};

export const INTERVAL = "1m";

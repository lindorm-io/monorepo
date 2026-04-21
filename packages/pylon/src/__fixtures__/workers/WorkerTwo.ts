import type { ReadableTime } from "@lindorm/date";
import type { LindormWorkerCallback } from "@lindorm/worker";

export const CALLBACK: LindormWorkerCallback = async (ctx) => {
  ctx.logger.debug("Hello world");
};

export const INTERVAL: ReadableTime = "2y";

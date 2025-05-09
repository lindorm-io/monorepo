import { ReadableTime } from "@lindorm/date";
import { LindormWorkerCallback } from "@lindorm/worker";

export const callback: LindormWorkerCallback = async (ctx) => {
  ctx.logger.debug("Hello world");
};

export const interval: ReadableTime = "2y";

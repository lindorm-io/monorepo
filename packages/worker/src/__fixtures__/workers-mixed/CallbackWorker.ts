import { LindormWorkerCallback } from "../../types";

export const CALLBACK: LindormWorkerCallback = async (ctx) => {
  ctx.logger.debug("Hello world");
};

export const INTERVAL = 2000;

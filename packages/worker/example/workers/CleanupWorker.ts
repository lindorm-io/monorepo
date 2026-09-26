import type { ReadableTime } from "@lindorm/date";
import type { RetryOptions } from "@lindorm/retry";
import type { LindormWorkerCallback } from "../../src/index.js";

export const CALLBACK: LindormWorkerCallback = async (ctx) => {
  ctx.logger.info("deleting expired rows", { seq: ctx.seq });
};

export const INTERVAL: ReadableTime = "15m";

export const JITTER: ReadableTime = "1m";

export const RETRY: RetryOptions = { maxAttempts: 3, strategy: "linear" };

import type { ReadableTime } from "@lindorm/date";
import type { RetryOptions } from "@lindorm/retry";
import type { LindormWorkerCallback } from "../../types/index.js";

export const CALLBACK: LindormWorkerCallback = async (ctx) => {
  ctx.logger.debug("Hello world");
};

export const INTERVAL: ReadableTime = "1w";

export const JITTER: ReadableTime = "1h";

export const RETRY: RetryOptions = {
  maxAttempts: 10,
  strategy: "linear",
  timeout: 1000,
  timeoutMax: 10000,
};

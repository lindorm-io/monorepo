import { ReadableTime } from "@lindorm/date";
import { RetryOptions, RetryStrategy } from "@lindorm/retry";
import { LindormWorkerCallback } from "@lindorm/worker";

export const callback: LindormWorkerCallback = async (ctx) => {
  ctx.logger.debug("Hello world");
};

export const interval: ReadableTime = "1w";

export const retry: RetryOptions = {
  maxAttempts: 10,
  strategy: RetryStrategy.Linear,
  timeout: 1000,
  timeoutMax: 10000,
};

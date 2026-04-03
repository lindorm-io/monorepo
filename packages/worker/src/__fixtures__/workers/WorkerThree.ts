import { RetryOptions } from "@lindorm/retry";
import { LindormWorkerCallback } from "../../types";

export const CALLBACK: LindormWorkerCallback = async (ctx) => {
  ctx.logger.debug("Hello world");
};

export const RETRY: RetryOptions = {
  maxAttempts: 10,
  strategy: "linear",
  timeout: 1000,
  timeoutMax: 10000,
};

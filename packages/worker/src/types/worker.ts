import type { ReadableTime } from "@lindorm/date";
import type { ILogger } from "@lindorm/logger";
import type { RetryOptions } from "@lindorm/retry";
import type { LindormWorkerCallback, LindormWorkerErrorCallback } from "./context.js";
import type { LindormWorkerListenerConfig } from "./listener.js";

export type CreateLindormWorkerSettings = {
  callbackTimeout?: ReadableTime | number;
  cron?: string;
  interval?: ReadableTime | number;
  listeners?: Array<LindormWorkerListenerConfig>;
  jitter?: ReadableTime | number;
  retry?: RetryOptions;
  timezone?: string;
};

export type LindormWorkerHealth = {
  alias: string;
  started: boolean;
  running: boolean;
  destroyed: boolean;
  seq: number;
  nextRun: Date | null;
  latestSuccess: Date | null;
  latestError: Date | null;
  latestTry: Date | null;
};

export type LindormWorkerSettings = {
  alias: string;
  callback: LindormWorkerCallback;
  callbackTimeout?: ReadableTime | number;
  cron?: string;
  errorCallback?: LindormWorkerErrorCallback;
  interval?: ReadableTime | number;
  listeners?: Array<LindormWorkerListenerConfig>;
  logger: ILogger;
  jitter?: ReadableTime | number;
  retry?: RetryOptions;
  timezone?: string;
};

import type { ReadableTime } from "@lindorm/date";
import type { ILogger } from "@lindorm/logger";
import type { RetryOptions } from "@lindorm/retry";
import type { LindormWorkerCallback, LindormWorkerErrorCallback } from "./context.js";
import type { LindormWorkerListenerConfig } from "./listener.js";

export type LindormWorkerConfig = {
  alias: string;
  callback: LindormWorkerCallback;
  callbackTimeout?: ReadableTime | number;
  errorCallback?: LindormWorkerErrorCallback;
  interval: ReadableTime | number;
  listeners?: Array<LindormWorkerListenerConfig>;
  jitter?: ReadableTime | number;
  retry?: RetryOptions;
};

export type CreateLindormWorkerOptions = {
  callbackTimeout?: ReadableTime | number;
  interval?: ReadableTime | number;
  listeners?: Array<LindormWorkerListenerConfig>;
  jitter?: ReadableTime | number;
  retry?: RetryOptions;
};

export type LindormWorkerHealth = {
  alias: string;
  started: boolean;
  running: boolean;
  destroyed: boolean;
  seq: number;
  latestSuccess: Date | null;
  latestError: Date | null;
  latestTry: Date | null;
};

export type LindormWorkerOptions = {
  alias: string;
  callback: LindormWorkerCallback;
  callbackTimeout?: ReadableTime | number;
  errorCallback?: LindormWorkerErrorCallback;
  interval: ReadableTime | number;
  listeners?: Array<LindormWorkerListenerConfig>;
  logger: ILogger;
  jitter?: ReadableTime | number;
  retry?: RetryOptions;
};

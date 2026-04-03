import { ReadableTime } from "@lindorm/date";
import { ILogger } from "@lindorm/logger";
import { RetryOptions } from "@lindorm/retry";
import { LindormWorkerCallback, LindormWorkerErrorCallback } from "./context";
import { LindormWorkerListenerConfig } from "./listener";

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

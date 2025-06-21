import { ReadableTime } from "@lindorm/date";
import { RetryOptions } from "@lindorm/retry";
import { LindormWorkerCallback, LindormWorkerErrorCallback } from "./context";
import { LindormWorkerListenerConfig } from "./listener";

export type LindormWorkerConfig = {
  alias: string;
  callback: LindormWorkerCallback;
  errorCallback?: LindormWorkerErrorCallback;
  interval: ReadableTime | number;
  listeners?: Array<LindormWorkerListenerConfig>;
  randomize?: ReadableTime | number;
  retry?: RetryOptions;
};

export type CreateLindormWorkerOptions = {
  interval?: ReadableTime | number;
  listeners?: Array<LindormWorkerListenerConfig>;
  randomize?: ReadableTime | number;
  retry?: RetryOptions;
};

export type LindormWorkerScannerInput = Array<LindormWorkerConfig | string>;

export type LindormWorkerScannerOutput = Array<LindormWorkerConfig>;

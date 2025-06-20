import { ReadableTime } from "@lindorm/date";
import { RetryOptions } from "@lindorm/retry";
import { LindormWorkerCallback } from "./context";
import { LindormWorkerListenerConfig } from "./listener";

export type LindormWorkerConfig = {
  alias: string;
  callback: LindormWorkerCallback;
  interval: ReadableTime | number | undefined;
  listeners: Array<LindormWorkerListenerConfig>;
  randomize: ReadableTime | number | undefined;
  retry: RetryOptions | undefined;
};

export type CreateLindormWorkerOptions = {
  interval?: ReadableTime | number;
  listeners?: Array<LindormWorkerListenerConfig>;
  randomize?: ReadableTime | number;
  retry?: RetryOptions;
};

export type LindormWorkerScannerInput = Array<LindormWorkerConfig | string>;

export type LindormWorkerScannerOutput = Array<LindormWorkerConfig>;

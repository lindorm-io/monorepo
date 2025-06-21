import { ReadableTime } from "@lindorm/date";
import { ILogger } from "@lindorm/logger";
import { RetryOptions } from "@lindorm/retry";
import { LindormWorkerCallback, LindormWorkerErrorCallback } from "./context";
import { LindormWorkerListenerConfig } from "./listener";

export type LindormWorkerOptions = {
  alias: string;
  callback: LindormWorkerCallback;
  errorCallback?: LindormWorkerErrorCallback;
  interval: ReadableTime | number;
  listeners?: Array<LindormWorkerListenerConfig>;
  logger: ILogger;
  randomize?: ReadableTime | number;
  retry?: RetryOptions;
};

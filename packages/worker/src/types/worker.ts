import { ReadableTime } from "@lindorm/date";
import { ILogger } from "@lindorm/logger";
import { RetryOptions } from "@lindorm/retry";
import { LindormWorkerCallback } from "./context";
import { LindormWorkerListenerConfig } from "./listener";

export type LindormWorkerOptions<T = unknown> = {
  alias: string;
  callback: LindormWorkerCallback<T>;
  interval: ReadableTime | number;
  listeners?: Array<LindormWorkerListenerConfig>;
  logger: ILogger;
  randomize?: ReadableTime | number;
  retry?: RetryOptions;
};

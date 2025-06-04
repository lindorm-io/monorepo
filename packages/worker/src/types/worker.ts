import { ReadableTime } from "@lindorm/date";
import { ILogger } from "@lindorm/logger";
import { RetryOptions } from "@lindorm/retry";
import { LindormWorkerCallback } from "./context";

export type LindormWorkerOptions<T = unknown> = {
  alias: string;
  callback: LindormWorkerCallback<T>;
  interval: ReadableTime | number;
  logger: ILogger;
  randomize?: ReadableTime | number;
  retry?: RetryOptions;
};

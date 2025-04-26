import { ReadableTime } from "@lindorm/date";
import { ILogger } from "@lindorm/logger";
import { RetryOptions } from "@lindorm/retry";
import { LindormWorkerCallback } from "./context";

export type LindormWorkerOptions = {
  alias: string;
  callback: LindormWorkerCallback;
  interval: ReadableTime | number;
  logger: ILogger;
  retry?: RetryOptions;
};

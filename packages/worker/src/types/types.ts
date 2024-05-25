import { ReadableTime } from "@lindorm/date";
import { ILogger } from "@lindorm/logger";
import { RetryOptions } from "@lindorm/retry";

export type LindormWorkerContext = {
  latestError: Date | null;
  latestSuccess: Date | null;
  latestTry: Date | null;
  logger: ILogger;
  seq: number;
};

export type LindormWorkerCallback = (ctx: LindormWorkerContext) => Promise<void | string>;

export type LindormWorkerOptions = {
  alias: string;
  callback: LindormWorkerCallback;
  interval: ReadableTime | number;
  logger: ILogger;
  retry?: RetryOptions;
};

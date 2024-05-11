import { Logger } from "@lindorm/logger";
import { RetryOptions } from "@lindorm/retry";

export type WorkerContext = {
  latestError: Date | null;
  latestSuccess: Date | null;
  latestTry: Date | null;
  logger: Logger;
  seq: number;
};

export type WorkerCallback = (ctx: WorkerContext) => Promise<void | string>;

export type LindormWorkerOptions = {
  alias: string;
  callback: WorkerCallback;
  interval: number;
  logger: Logger;
  retry?: RetryOptions;
};

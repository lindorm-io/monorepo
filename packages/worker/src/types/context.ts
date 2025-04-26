import { ILogger } from "@lindorm/logger";

export type LindormWorkerContext = {
  latestError: Date | null;
  latestSuccess: Date | null;
  latestTry: Date | null;
  logger: ILogger;
  seq: number;
};

export type LindormWorkerCallback = (ctx: LindormWorkerContext) => Promise<void | string>;

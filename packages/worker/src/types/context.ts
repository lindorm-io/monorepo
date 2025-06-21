import { ILogger } from "@lindorm/logger";
import { LindormWorkerError } from "../errors/LindormWorkerError";

export type LindormWorkerContext = {
  latestError: Date | null;
  latestSuccess: Date | null;
  latestTry: Date | null;
  logger: ILogger;
  seq: number;
};

export type LindormWorkerCallback = (ctx: LindormWorkerContext) => Promise<void>;

export type LindormWorkerErrorCallback = (
  ctx: LindormWorkerContext,
  error: LindormWorkerError,
) => Promise<void>;

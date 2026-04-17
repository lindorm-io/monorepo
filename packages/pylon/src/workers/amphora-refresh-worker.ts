import { IAmphora } from "@lindorm/amphora";
import { ILogger } from "@lindorm/logger";
import { CreateLindormWorkerOptions, LindormWorker } from "@lindorm/worker";

type Options = CreateLindormWorkerOptions & {
  amphora: IAmphora;
  logger: ILogger;
};

export const createAmphoraRefreshWorker = (options: Options): LindormWorker =>
  new LindormWorker({
    alias: "AmphoraRefreshWorker",
    interval: options.interval ?? "15m",
    listeners: options.listeners ?? [],
    jitter: options.jitter,
    retry: options.retry,
    logger: options.logger,
    callback: options.amphora.refresh.bind(options.amphora),
  });

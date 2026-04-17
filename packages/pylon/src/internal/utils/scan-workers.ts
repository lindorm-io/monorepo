import { IAmphora } from "@lindorm/amphora";
import { ReadableTime } from "@lindorm/date";
import { ILogger } from "@lindorm/logger";
import { RetryOptions } from "@lindorm/retry";
import { ILindormWorker, LindormWorker, LindormWorkerScanner } from "@lindorm/worker";

type Options = {
  amphora: IAmphora;
  logger: ILogger;
  workers?: Array<ILindormWorker | string>;
  workersInterval?: ReadableTime;
  workersRetry?: RetryOptions;
};

export const scanWorkers = (options: Options): Array<ILindormWorker> => {
  const { workers = [], workersInterval = "5m", workersRetry } = options;

  return [
    new LindormWorker({
      alias: "AmphoraWorker",
      callback: () => options.amphora.refresh(),
      interval: workersInterval,
      logger: options.logger,
      retry: workersRetry,
    }),
    ...LindormWorkerScanner.scan(workers, options.logger),
  ];
};

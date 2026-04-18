import { IAmphora } from "@lindorm/amphora";
import { ReadableTime } from "@lindorm/date";
import { ILogger } from "@lindorm/logger";
import { RetryOptions } from "@lindorm/retry";
import { ILindormWorker, LindormWorker, LindormWorkerScanner } from "@lindorm/worker";

type Options = {
  amphora: IAmphora;
  logger: ILogger;
  workers?: string | ILindormWorker | Array<ILindormWorker | string>;
  workersInterval?: ReadableTime;
  workersRetry?: RetryOptions;
};

const normalise = (input: Options["workers"]): Array<ILindormWorker | string> => {
  if (input === undefined) return [];
  if (Array.isArray(input)) return input;
  if (typeof input === "string" || input instanceof LindormWorker) return [input];
  return [];
};

export const scanWorkers = (options: Options): Array<ILindormWorker> => {
  const { workersInterval = "5m", workersRetry } = options;
  const workers = normalise(options.workers);

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

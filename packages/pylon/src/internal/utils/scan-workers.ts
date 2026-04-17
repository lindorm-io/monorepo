import { IAmphora } from "@lindorm/amphora";
import { pascalCase } from "@lindorm/case";
import { ReadableTime } from "@lindorm/date";
import { ILogger } from "@lindorm/logger";
import { RetryOptions } from "@lindorm/retry";
import {
  ILindormWorker,
  LindormWorker,
  LindormWorkerConfig,
  LindormWorkerScanner,
  LindormWorkerScannerInput,
} from "@lindorm/worker";

type Options = {
  amphora: IAmphora;
  logger: ILogger;
  workers?: Array<ILindormWorker | LindormWorkerConfig | string>;
  workersInterval?: ReadableTime;
  workersRetry?: RetryOptions;
};

export const scanWorkers = (options: Options): Array<ILindormWorker> => {
  const { workers = [], workersInterval = "5m", workersRetry } = options;

  const instances = workers.filter(
    (a): a is ILindormWorker => a instanceof LindormWorker,
  );

  const remaining = workers.filter(
    (a): a is LindormWorkerConfig | string => !(a instanceof LindormWorker),
  ) as LindormWorkerScannerInput;

  const result: Array<ILindormWorker> = [
    new LindormWorker({
      alias: "AmphoraWorker",
      callback: () => options.amphora.refresh(),
      interval: workersInterval,
      logger: options.logger,
      retry: workersRetry,
    }),
    ...instances,
  ];

  const scan = LindormWorkerScanner.scan(remaining);

  for (const item of scan) {
    if (item instanceof LindormWorker) {
      result.push(item);
      continue;
    }

    const config = item as LindormWorkerConfig;

    result.push(
      new LindormWorker({
        alias: pascalCase(config.alias),
        callback: config.callback,
        interval: config.interval ?? workersInterval,
        logger: options.logger,
        retry: config.retry ?? workersRetry,
      }),
    );
  }

  return result;
};

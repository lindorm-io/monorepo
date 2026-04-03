import { IAmphora } from "@lindorm/amphora";
import { pascalCase } from "@lindorm/case";
import { ReadableTime } from "@lindorm/date";
import { isObject, isString } from "@lindorm/is";
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

  const result: Array<ILindormWorker> = [
    new LindormWorker({
      alias: "AmphoraWorker",
      callback: () => options.amphora.refresh(),
      interval: workersInterval,
      logger: options.logger,
      retry: workersRetry,
    }),
    ...(workers.filter((a) => !isObject(a) && !isString(a)) as Array<ILindormWorker>),
  ];

  const scan = LindormWorkerScanner.scan(
    workers.filter((a) => isObject(a) || isString(a)) as LindormWorkerScannerInput,
  );

  for (const config of scan) {
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

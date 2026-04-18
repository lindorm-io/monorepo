import { IAmphora } from "@lindorm/amphora";
import { ILogger } from "@lindorm/logger";
import { ILindormWorker, LindormWorker, LindormWorkerScanner } from "@lindorm/worker";

type Options = {
  amphora: IAmphora;
  logger: ILogger;
  workers?: string | ILindormWorker | Array<ILindormWorker | string>;
};

const normalise = (input: Options["workers"]): Array<ILindormWorker | string> => {
  if (input === undefined) return [];
  if (Array.isArray(input)) return input;
  if (typeof input === "string" || input instanceof LindormWorker) return [input];
  return [];
};

export const scanWorkers = (options: Options): Array<ILindormWorker> => {
  const workers = normalise(options.workers);

  return [
    new LindormWorker({
      alias: "AmphoraWorker",
      callback: () => options.amphora.refresh(),
      interval: "5m",
      logger: options.logger,
    }),
    ...LindormWorkerScanner.scan(workers, options.logger),
  ];
};

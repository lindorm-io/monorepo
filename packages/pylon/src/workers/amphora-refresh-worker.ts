import { IAmphora } from "@lindorm/amphora";
import { CreateLindormWorkerOptions, LindormWorkerConfig } from "@lindorm/worker";

type Options = CreateLindormWorkerOptions & {
  amphora: IAmphora;
};

export const createAmphoraRefreshWorker = (options: Options): LindormWorkerConfig => ({
  alias: "AmphoraRefreshWorker",
  interval: options.interval ?? "15m",
  listeners: options.listeners ?? [],
  randomize: options.randomize,
  retry: options.retry,
  callback: options.amphora.refresh.bind(options.amphora),
});

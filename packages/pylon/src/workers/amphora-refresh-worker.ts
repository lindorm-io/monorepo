import { IAmphora } from "@lindorm/amphora";
import { CreateLindormWorkerOptions, LindormWorkerConfig } from "@lindorm/worker";

type Options = CreateLindormWorkerOptions & {
  amphora: IAmphora;
};

export const createAmphoraRefreshWorker = (options: Options): LindormWorkerConfig => ({
  alias: "AmphoraRefreshWorker",
  interval: options.interval ?? "15m",
  retry: options.retry,
  randomize: options.randomize,
  callback: options.amphora.refresh.bind(options.amphora),
});

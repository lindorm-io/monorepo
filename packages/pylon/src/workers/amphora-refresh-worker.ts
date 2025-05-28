import { IAmphora } from "@lindorm/amphora";
import { ReadableTime } from "@lindorm/date";
import { RetryOptions } from "@lindorm/retry";
import { LindormWorkerConfig } from "@lindorm/worker";

type Options = {
  amphora: IAmphora;
  interval?: ReadableTime;
  retry?: RetryOptions;
};

export const createAmphoraRefreshWorker = (options: Options): LindormWorkerConfig => ({
  alias: "AmphoraRefreshWorker",
  interval: options.interval ?? "12h",
  retry: options.retry,
  callback: async (): Promise<void> => {
    await options.amphora.refresh();
  },
});

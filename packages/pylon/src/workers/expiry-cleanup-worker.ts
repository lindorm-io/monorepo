import { IEntity, IProteusSource } from "@lindorm/proteus";
import { Constructor } from "@lindorm/types";
import { CreateLindormWorkerOptions, LindormWorkerConfig } from "@lindorm/worker";

type Options = CreateLindormWorkerOptions & {
  proteus: IProteusSource;
  targets: Array<Constructor<IEntity>>;
};

export const createExpiryCleanupWorker = (options: Options): LindormWorkerConfig => ({
  alias: "ExpiryCleanupWorker",
  interval: options.interval ?? "15m",
  listeners: options.listeners ?? [],
  jitter: options.jitter,
  retry: options.retry,
  callback: async (_ctx): Promise<void> => {
    for (const target of options.targets) {
      const repository = options.proteus.repository(target);
      await repository.deleteExpired();
    }
  },
});

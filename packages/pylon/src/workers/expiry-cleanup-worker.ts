import { IEntity } from "@lindorm/entity";
import { IMongoSource } from "@lindorm/mongo";
import { Constructor } from "@lindorm/types";
import { CreateLindormWorkerOptions, LindormWorkerConfig } from "@lindorm/worker";

type Options = CreateLindormWorkerOptions & {
  source: IMongoSource;
  targets: Array<Constructor<IEntity>>;
};

export const createExpiryCleanupWorker = (options: Options): LindormWorkerConfig => ({
  alias: "ExpiryCleanupWorker",
  interval: options.interval ?? "15m",
  listeners: options.listeners ?? [],
  randomize: options.randomize,
  retry: options.retry,
  callback: async (ctx): Promise<void> => {
    for (const target of options.targets) {
      const repository = options.source.repository(target, { logger: ctx.logger });
      await repository.deleteExpired();
    }
  },
});

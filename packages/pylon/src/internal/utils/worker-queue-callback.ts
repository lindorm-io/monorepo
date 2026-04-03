import { Constructor } from "@lindorm/types";
import { LindormWorkerCallback, LindormWorkerContext } from "@lindorm/worker";
import { QueueFailedError } from "../../errors";
import { IQueueableEntity } from "../../interfaces";
import { PylonEntitySource } from "../../types";
import { getQueueableRepository } from "./get-queueable-repository";
import { sortJobEntities } from "./sort-job-entities";

type Options<T extends IQueueableEntity> = {
  source: PylonEntitySource;
  target: Constructor<T>;
  callback: (ctx: LindormWorkerContext, queueable: T) => Promise<void>;
};

export const createWorkerQueueCallback = <T extends IQueueableEntity>(
  options: Options<T>,
): LindormWorkerCallback =>
  async function workerQueueCallback(ctx): Promise<void> {
    const repository = getQueueableRepository<T>(
      options.source,
      ctx.logger,
      options.target,
    );

    const entities = await repository.find({
      acknowledgedAt: { $eq: null },
      failedAt: { $eq: null },
    });

    if (!entities.length) {
      ctx.logger.debug("No queuable items found");
      return;
    }

    const [entity] = entities.sort(sortJobEntities);

    entity.acknowledgedAt = new Date();

    const current = await repository.update(entity);

    try {
      await options.callback(ctx, current);
    } catch (error: any) {
      current.acknowledgedAt = null;

      await repository.update(current);

      throw new QueueFailedError(error.message, {
        debug: { id: current.id },
        error,
      });
    }

    await repository.destroy(current);
  };

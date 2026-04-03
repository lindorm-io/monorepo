import { Constructor } from "@lindorm/types";
import { LindormWorkerErrorCallback } from "@lindorm/worker";
import { QueueFailedError } from "../../errors";
import { IQueueableEntity } from "../../interfaces";
import { PylonEntitySource } from "../../types";
import { getQueueableRepository } from "./get-queueable-repository";

type Options<T extends IQueueableEntity> = {
  source: PylonEntitySource;
  target: Constructor<T>;
};

export const createWorkerQueueErrorCallback = <T extends IQueueableEntity>(
  options: Options<T>,
): LindormWorkerErrorCallback =>
  async function workerQueueErrorCallback(ctx, error): Promise<void> {
    if (!(error instanceof QueueFailedError)) return;

    const repository = getQueueableRepository<T>(
      options.source,
      ctx.logger,
      options.target,
    );

    const {
      debug: { id },
    } = error.toJSON();

    const entity = await repository.findOneOrFail({ id });

    entity.failedAt = new Date();

    await repository.update(entity);
  };

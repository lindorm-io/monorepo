import { LindormError } from "@lindorm/errors";
import { Constructor } from "@lindorm/types";
import { LindormWorkerConfig } from "@lindorm/worker";
import { MnemosJobEntity, MongoJobEntity, RedisJobEntity } from "../../../entities";
import { IJobEntity } from "../../../interfaces";
import { PylonEntityQueueOptions, PylonEntitySource, PylonSource } from "../../../types";
import { getSource } from "../get-source";
import { createWorkerQueueCallback } from "../worker-queue-callback";
import { createWorkerQueueErrorCallback } from "../worker-queue-error-callback";

const getTarget = (source: PylonEntitySource): Constructor<IJobEntity> => {
  switch (source.name) {
    case "MnemosSource":
      return MnemosJobEntity;

    case "MongoSource":
      return MongoJobEntity;

    case "RedisSource":
      return RedisJobEntity;

    default:
      throw new LindormError("Unsupported source type", { debug: { source } });
  }
};

export const createQueueWorker = (
  options: PylonEntityQueueOptions,
  sources: Map<string, PylonSource>,
): LindormWorkerConfig => {
  const source = getSource<PylonEntitySource>(sources, options.source);
  const target = getTarget(source);

  return {
    alias: "QueueWorker",
    interval: options.worker?.interval ?? "2s",
    listeners: options.worker?.listeners,
    randomize: options.worker?.randomize ?? "1s",
    retry: options.worker?.retry,
    callback: createWorkerQueueCallback({
      source,
      target,
      callback: async (_, job) => {
        const handler = options.handlers[job.event];
        if (!handler) {
          throw new LindormError("Queue handler not found", { debug: { job } });
        }
        await handler(job);
      },
    }),
    errorCallback: createWorkerQueueErrorCallback({
      source,
      target,
    }),
  };
};

import { ConduitClientCredentialsCache } from "@lindorm/conduit";
import { LindormError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { LindormWorkerConfig } from "@lindorm/worker";
import {
  MnemosWebhookDispatchEntity,
  MongoWebhookDispatchEntity,
  RedisWebhookDispatchEntity,
} from "../../../entities";
import { IWebhookDispatchEntity } from "../../../interfaces";
import {
  PylonEntitySource,
  PylonEntityWebhookOptions,
  PylonSource,
} from "../../../types";
import { createDispatchWebhook } from "../dispatch-webhook";
import { getSource } from "../get-source";
import { createWorkerQueueCallback } from "../worker-queue-callback";
import { createWorkerQueueErrorCallback } from "../worker-queue-error-callback";

const getTarget = (source: PylonEntitySource): Constructor<IWebhookDispatchEntity> => {
  switch (source.name) {
    case "MnemosSource":
      return MnemosWebhookDispatchEntity;

    case "MongoSource":
      return MongoWebhookDispatchEntity;

    case "RedisSource":
      return RedisWebhookDispatchEntity;

    default:
      throw new LindormError("Unsupported source type", { debug: { source } });
  }
};

export const createWebhookDispatchWorker = (
  options: PylonEntityWebhookOptions,
  sources: Map<string, PylonSource>,
  logger: ILogger,
  cache: ConduitClientCredentialsCache = [],
): LindormWorkerConfig => {
  const source = getSource<PylonEntitySource>(sources, options.source);
  const target = getTarget(source);

  const dispatch = createDispatchWebhook(options, logger, cache);

  return {
    alias: "WebhookDispatchWorker",
    interval: options.worker?.interval ?? "2s",
    listeners: options.worker?.listeners,
    randomize: options.worker?.randomize ?? "1s",
    retry: options.worker?.retry,
    callback: createWorkerQueueCallback({
      source,
      target,
      callback: async (_, webhook) => await dispatch(webhook),
    }),
    errorCallback: createWorkerQueueErrorCallback({
      source,
      target,
    }),
  };
};

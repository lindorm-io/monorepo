import { ClientCache, ClientRepository } from "../infrastructure";
import { IntervalWorker } from "@lindorm-io/koa";
import { mongoConnection, redisConnection } from "../instance";
import { stringToMilliseconds } from "@lindorm-io/expiry";
import { logger as winston } from "../server/logger";

const logger = winston.createChildLogger(["clientCacheWorker"]);
const time = stringToMilliseconds("60 minutes");

export const clientCacheWorker = new IntervalWorker(
  {
    callback: async (): Promise<void> => {
      const repository = new ClientRepository({
        connection: mongoConnection,
        logger,
      });

      const cache = new ClientCache({ connection: redisConnection, logger });

      const clients = await repository.findMany({});

      for (const client of clients) {
        await cache.create(client);
      }
    },
    time,
  },
  logger,
);

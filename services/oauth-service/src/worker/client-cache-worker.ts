import { ClientCache, ClientRepository } from "../infrastructure";
import { IntervalWorker } from "@lindorm-io/koa";
import { mongoConnection, redisConnection } from "../instance";
import { stringToMilliseconds, stringToSeconds } from "@lindorm-io/core";
import { winston } from "../server/logger";

const logger = winston.createChildLogger(["clientCacheWorker"]);
const expiresInSeconds = stringToSeconds("62 minutes");
const time = stringToMilliseconds("60 minutes");

export const clientCacheWorker = new IntervalWorker({
  callback: async (): Promise<void> => {
    const repository = new ClientRepository({
      connection: mongoConnection,
      logger,
    });

    const cache = new ClientCache({
      connection: redisConnection,
      expiresInSeconds,
      logger,
    });

    const clients = await repository.findMany({});

    for (const client of clients) {
      await cache.create(client);
    }
  },
  logger,
  time,
});

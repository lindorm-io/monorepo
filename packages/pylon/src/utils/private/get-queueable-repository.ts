import { LindormError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { IQueueableEntity } from "../../interfaces";
import { PylonEntityRepository, PylonEntitySource } from "../../types";

export const getQueueableRepository = <T extends IQueueableEntity>(
  source: PylonEntitySource,
  logger: ILogger,
  target: Constructor<T>,
): PylonEntityRepository<any> => {
  switch (source.name) {
    case "MnemosSource":
      return source.repository(target, { logger });

    case "MongoSource":
      return source.repository(target, { logger });

    case "RedisSource":
      return source.repository(target, { logger });

    default:
      throw new LindormError("Unsupported source type", { debug: { source } });
  }
};

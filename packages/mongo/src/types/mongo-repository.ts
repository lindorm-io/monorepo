import type { IEntity } from "@lindorm/entity";
import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { MongoClient, FindOptions as MongoFindOptions } from "mongodb";

export type FindOptions<E extends IEntity> = MongoFindOptions<E> & {
  versionTimestamp?: Date;
};

export type MongoRepositoryOptions<E extends IEntity> = {
  Entity: Constructor<E>;
  client: MongoClient;
  database?: string;
  logger: ILogger;
  namespace?: string;
};

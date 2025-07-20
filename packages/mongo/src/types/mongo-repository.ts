import type { IEntity } from "@lindorm/entity";
import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type {
  Filter,
  MongoClient,
  CountDocumentsOptions as MongoCountDocumentsOptions,
  DeleteOptions as MongoDeleteOptions,
  FindOptions as MongoFindOptions,
} from "mongodb";

export type CountDocumentsOptions<E extends IEntity> = MongoCountDocumentsOptions & {
  mongoFilter?: Filter<E>;
};

export type FindOptions<E extends IEntity> = MongoFindOptions<E> & {
  mongoFilter?: Filter<E>;
  versionTimestamp?: Date;
};

export type DeleteOptions<E extends IEntity> = MongoDeleteOptions & {
  mongoFilter?: Filter<E>;
};

export type MongoRepositoryOptions<E extends IEntity> = {
  target: Constructor<E>;
  client: MongoClient;
  database?: string;
  logger: ILogger;
  namespace?: string;
};

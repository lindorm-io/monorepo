import { IEntityBase } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { MongoClient } from "mongodb";
import {
  CreateMongoEntityFn,
  MongoEntityConfig,
  ValidateMongoEntityFn,
} from "./mongo-entity";
import { MongoIndexOptions } from "./mongo-index";

export type MongoRepositoryOptions<E extends IEntityBase> = {
  Entity: Constructor<E>;
  client: MongoClient;
  config?: MongoEntityConfig<E>;
  database: string;
  indexes?: Array<MongoIndexOptions<E>>;
  logger: ILogger;
  namespace?: string;
  create?: CreateMongoEntityFn<E>;
  validate?: ValidateMongoEntityFn<E>;
};

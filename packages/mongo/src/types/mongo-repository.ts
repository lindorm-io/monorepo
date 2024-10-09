import { IEntity } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { MongoClient } from "mongodb";
import { MongoEntityConfig } from "./mongo-entity-config";
import { MongoIndexOptions } from "./mongo-index";

export type CreateMongoEntityFn<E extends IEntity = IEntity> = (
  options: DeepPartial<E>,
) => E;

export type ValidateMongoEntityFn<E extends IEntity = IEntity> = (
  entity: Omit<
    E,
    "id" | "rev" | "seq" | "createdAt" | "updatedAt" | "deletedAt" | "expiresAt"
  >,
) => void;

export type MongoRepositoryOptions<E extends IEntity> = {
  Entity: Constructor<E>;
  client: MongoClient;
  config?: MongoEntityConfig;
  database: string;
  indexes?: Array<MongoIndexOptions<E>>;
  logger: ILogger;
  namespace?: string;
  create?: CreateMongoEntityFn<E>;
  validate?: ValidateMongoEntityFn<E>;
};

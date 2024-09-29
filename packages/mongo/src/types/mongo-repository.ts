import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { MongoClient } from "mongodb";
import { IMongoEntity } from "../interfaces";
import { MongoEntityConfig } from "./mongo-entity-config";
import { MongoIndexOptions } from "./mongo-index";

export type CreateMongoEntityFn<E extends IMongoEntity = IMongoEntity> = (
  options: DeepPartial<E>,
) => E;

export type ValidateMongoEntityFn<E extends IMongoEntity = IMongoEntity> = (
  entity: Omit<
    E,
    "id" | "rev" | "seq" | "createdAt" | "updatedAt" | "deletedAt" | "expiresAt"
  >,
) => void;

export type MongoRepositoryOptions<E extends IMongoEntity> = {
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

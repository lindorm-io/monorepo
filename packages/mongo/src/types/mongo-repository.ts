import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { MongoClient } from "mongodb";
import { IMongoEntity } from "../interfaces";
import { MongoIndexOptions } from "./mongo-index";

export type ValidateMongoEntityFn<E extends IMongoEntity = IMongoEntity> = (
  entity: Omit<
    E,
    "id" | "revision" | "createdAt" | "updatedAt" | "deletedAt" | "expiresAt"
  >,
) => void;

export type MongoRepositoryOptions<E extends IMongoEntity> = {
  Entity: Constructor<E>;
  client: MongoClient;
  database: string;
  indexes?: Array<MongoIndexOptions<E>>;
  logger: ILogger;
  namespace?: string;
  validate?: ValidateMongoEntityFn<E>;
};

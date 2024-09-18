import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { MongoClient } from "mongodb";
import {
  FileIndex,
  MongoIndexOptions,
  ValidateFileFn,
  ValidateMongoEntityFn,
} from "../types";
import { MongoEntityConfig } from "../types/mongo-entity-config";
import { IMongoBucket } from "./MongoBucket";
import { IMongoEntity } from "./MongoEntity";
import { IMongoFile } from "./MongoFile";
import { IMongoRepository } from "./MongoRepository";

export type MongoSourceRepositoryOptions<E extends IMongoEntity> = {
  config?: MongoEntityConfig;
  indexes?: Array<MongoIndexOptions<E>>;
  logger?: ILogger;
  validate?: ValidateMongoEntityFn<E>;
};

export type MongoSourceBucketOptions<F extends IMongoFile> = {
  indexes?: Array<MongoIndexOptions<FileIndex<F>>>;
  logger?: ILogger;
  validate?: ValidateFileFn<F>;
};

export interface IMongoSource {
  client: MongoClient;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setup(): Promise<void>;

  bucket<F extends IMongoFile>(
    File: Constructor<F>,
    options?: MongoSourceBucketOptions<F>,
  ): IMongoBucket<F>;
  repository<E extends IMongoEntity, O extends DeepPartial<E> = DeepPartial<E>>(
    Entity: Constructor<E>,
    options?: MongoSourceRepositoryOptions<E>,
  ): IMongoRepository<E, O>;
}

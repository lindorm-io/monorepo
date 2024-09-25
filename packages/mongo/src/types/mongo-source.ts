import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { MongoOptions } from "mongodb";
import { IMongoEntity, IMongoFile } from "../interfaces";
import { ValidateFileFn } from "./mongo-bucket";
import { MongoEntityConfig } from "./mongo-entity-config";
import { FileIndex } from "./mongo-file";
import { MongoIndexOptions } from "./mongo-index";
import { ValidateMongoEntityFn } from "./mongo-repository";

export type MongoSourceEntity<E extends IMongoEntity = IMongoEntity> = {
  Entity: Constructor<E>;
  config?: MongoEntityConfig;
  indexes?: Array<MongoIndexOptions<E>>;
  validate?: ValidateMongoEntityFn<E>;
};

export type MongoSourceFile<F extends IMongoFile = IMongoFile> = {
  File: Constructor<F>;
  indexes?: Array<MongoIndexOptions<FileIndex<F>>>;
  validate?: ValidateFileFn<F>;
};

export type MongoSourceEntities = Array<
  Constructor<IMongoEntity> | MongoSourceEntity | string
>;

export type MongoSourceFiles = Array<Constructor<IMongoFile> | MongoSourceFile | string>;

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

export type CloneMongoSourceOptions = {
  logger?: ILogger;
};

export type MongoSourceOptions = {
  config?: MongoOptions;
  database: string;
  entities?: MongoSourceEntities;
  files?: MongoSourceFiles;
  logger: ILogger;
  namespace?: string;
  url: string;
};

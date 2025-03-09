import type { EntityScannerInput, IEntity } from "@lindorm/entity";
import type { ILogger } from "@lindorm/logger";
import type { MongoOptions } from "mongodb";
import { IMongoFile } from "../interfaces";

export type MongoSourceRepositoryOptions = {
  logger?: ILogger;
};

export type MongoSourceBucketOptions = {
  logger?: ILogger;
};

export type CloneMongoSourceOptions = {
  logger?: ILogger;
};

export type MongoSourceOptions = {
  config?: MongoOptions;
  database?: string;
  entities?: EntityScannerInput<IEntity>;
  files?: EntityScannerInput<IMongoFile>;
  logger: ILogger;
  namespace?: string;
  url: string;
};

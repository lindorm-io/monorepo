import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { MongoClient } from "mongodb";
import { IMongoFile } from "../interfaces";
import { FileIndex, FileMetadata } from "./mongo-file";
import { MongoIndexOptions } from "./mongo-index";

export type ValidateFileFn<F extends IMongoFile = IMongoFile> = (
  metadata: FileMetadata<F>,
) => void;

export type MongoBucketOptions<F extends IMongoFile> = {
  File: Constructor<F>;
  chunkSizeBytes?: number;
  client: MongoClient;
  database: string;
  indexes?: Array<MongoIndexOptions<FileIndex<F>>>;
  logger: ILogger;
  namespace?: string;
  validate?: ValidateFileFn<F>;
};

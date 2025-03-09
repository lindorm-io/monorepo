import type { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import type { MongoClient } from "mongodb";
import type { Readable } from "stream";
import type { IMongoFile } from "../interfaces";

export type FileUpload<F extends IMongoFile> = Omit<
  F,
  "chunkSize" | "filename" | "length" | "uploadDate"
>;

export type FileDownload<F extends IMongoFile> = F & {
  stream: Readable;
};

export type MongoBucketOptions<F extends IMongoFile> = {
  File: Constructor<F>;
  chunkSizeBytes?: number;
  client: MongoClient;
  database?: string;
  logger: ILogger;
  namespace?: string;
};

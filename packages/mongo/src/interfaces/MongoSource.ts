import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { MongoClient } from "mongodb";
import { MongoSourceBucketOptions, MongoSourceRepositoryOptions } from "../types";
import { IMongoBucket } from "./MongoBucket";
import { IMongoEntity } from "./MongoEntity";
import { IMongoFile } from "./MongoFile";
import { IMongoRepository } from "./MongoRepository";

export interface IMongoSource {
  client: MongoClient;

  clone(logger?: ILogger): IMongoSource;
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

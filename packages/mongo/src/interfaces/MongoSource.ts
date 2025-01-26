import { Constructor, DeepPartial } from "@lindorm/types";
import { Collection, Db, Document, MongoClient } from "mongodb";
import {
  CloneMongoSourceOptions,
  MongoSourceBucketOptions,
  MongoSourceEntities,
  MongoSourceFiles,
  MongoSourceRepositoryOptions,
} from "../types";
import { IMongoBucket } from "./MongoBucket";
import { IMongoEntity } from "./MongoEntity";
import { IMongoFile } from "./MongoFile";
import { IMongoRepository } from "./MongoRepository";

export interface IMongoSource {
  client: MongoClient;
  database: Db;

  addEntities(entities: MongoSourceEntities): void;
  addFiles(files: MongoSourceFiles): void;
  clone(options?: CloneMongoSourceOptions): IMongoSource;
  collection<D extends Document>(name: string): Collection<D>;
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

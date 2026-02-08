import { EntityScannerInput, IEntity } from "@lindorm/entity";
import { Constructor, DeepPartial } from "@lindorm/types";
import { Collection, Db, Document, MongoClient } from "mongodb";
import {
  CloneMongoSourceOptions,
  MongoSourceBucketOptions,
  MongoSourceRepositoryOptions,
} from "../types";
import { FileScannerInput } from "../types/file-scanner";
import { IMongoBucket } from "./MongoBucket";
import { IMongoFile } from "./MongoFile";
import { IMongoRepository } from "./MongoRepository";

export interface IMongoSource {
  __instanceof: "MongoSource";

  client: MongoClient;
  database: Db;

  clone(options?: CloneMongoSourceOptions): IMongoSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ping(): Promise<void>;
  setup(): Promise<void>;

  collection<D extends Document>(name: string): Collection<D>;

  addEntities(entities: EntityScannerInput): void;
  addFiles(files: FileScannerInput): void;

  hasEntity(target: Constructor<IEntity>): boolean;
  hasFile(target: Constructor<IMongoFile>): boolean;

  repository<E extends IEntity, O extends DeepPartial<E> = DeepPartial<E>>(
    Entity: Constructor<E>,
    options?: MongoSourceRepositoryOptions,
  ): IMongoRepository<E, O>;

  bucket<F extends IMongoFile>(
    File: Constructor<F>,
    options?: MongoSourceBucketOptions,
  ): IMongoBucket<F>;
}

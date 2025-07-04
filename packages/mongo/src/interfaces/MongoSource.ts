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
  name: "MongoSource";

  client: MongoClient;
  database: Db;

  clone(options?: CloneMongoSourceOptions): IMongoSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setup(): Promise<void>;

  collection<D extends Document>(name: string): Collection<D>;

  addEntities(entities: EntityScannerInput): void;
  repository<E extends IEntity, O extends DeepPartial<E> = DeepPartial<E>>(
    Entity: Constructor<E>,
    options?: MongoSourceRepositoryOptions,
  ): IMongoRepository<E, O>;

  addFiles(files: FileScannerInput): void;
  bucket<F extends IMongoFile>(
    File: Constructor<F>,
    options?: MongoSourceBucketOptions,
  ): IMongoBucket<F>;
}

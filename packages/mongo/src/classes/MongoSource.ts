import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { MongoClient } from "mongodb";
import { MongoSourceError } from "../errors";
import {
  IMongoBucket,
  IMongoEntity,
  IMongoFile,
  IMongoRepository,
  IMongoSource,
} from "../interfaces";
import {
  MongoSourceBucketOptions,
  MongoSourceEntity,
  MongoSourceFile,
  MongoSourceOptions,
  MongoSourceRepositoryOptions,
} from "../types";
import { MongoBucket } from "./MongoBucket";
import { MongoRepository } from "./MongoRepository";
import { EntityScanner, FileScanner } from "./private";

export class MongoSource implements IMongoSource {
  private readonly database: string;
  private readonly entities: Array<MongoSourceEntity>;
  private readonly files: Array<MongoSourceFile>;
  private readonly logger: ILogger;
  private readonly namespace: string | undefined;

  public readonly client: MongoClient;

  public constructor(options: MongoSourceOptions) {
    this.logger = options.logger.child(["MongoSource"]);
    this.database = options.database;
    this.namespace = options.namespace;

    this.client = options.config
      ? new MongoClient(options.url, options.config)
      : new MongoClient(options.url);

    this.entities = options.entities ? EntityScanner.scan(options.entities) : [];
    this.files = options.files ? FileScanner.scan(options.files) : [];
  }

  // public

  public async connect(): Promise<void> {
    await this.client.connect();
  }

  public async disconnect(): Promise<void> {
    await this.client.close();
  }

  public bucket<F extends IMongoFile>(
    File: Constructor<F>,
    options: MongoSourceBucketOptions<F> = {},
  ): IMongoBucket<F> {
    const config = this.fileConfig(File);

    return new MongoBucket({
      File,
      client: this.client,
      database: this.database,
      indexes: options.indexes ?? config.indexes,
      logger: options.logger ?? this.logger,
      namespace: this.namespace,
      validate: options.validate ?? config.validate,
    });
  }

  public repository<E extends IMongoEntity>(
    Entity: Constructor<E>,
    options: MongoSourceRepositoryOptions<E> = {},
  ): IMongoRepository<E> {
    const config = this.entityConfig(Entity);

    return new MongoRepository({
      Entity,
      config: options.config ?? config.config,
      database: this.database,
      indexes: options.indexes ?? config.indexes,
      logger: options.logger ?? this.logger,
      client: this.client,
      namespace: this.namespace,
      validate: options.validate ?? config.validate,
    });
  }

  public async setup(): Promise<void> {
    await this.client.connect();

    for (const entity of this.entities) {
      await this.repository(entity.Entity).setup();
    }
  }

  // private

  private entityConfig(Entity: Constructor<IMongoEntity>): MongoSourceEntity {
    const config = this.entities.find((entity) => entity.Entity === Entity);

    if (config) {
      return config;
    }

    throw new MongoSourceError("Entity not found in entities list", {
      debug: { Entity },
    });
  }

  private fileConfig(File: Constructor<IMongoFile>): MongoSourceFile {
    const config = this.files.find((file) => file.File === File);

    if (config) {
      return config;
    }

    throw new MongoSourceError("File not found in files list", { debug: { File } });
  }
}

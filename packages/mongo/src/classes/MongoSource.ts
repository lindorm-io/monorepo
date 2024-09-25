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
  CloneMongoSourceOptions,
  MongoSourceBucketOptions,
  MongoSourceEntity,
  MongoSourceFile,
  MongoSourceOptions,
  MongoSourceRepositoryOptions,
} from "../types";
import { FromClone } from "../types/private";
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

  public constructor(options: MongoSourceOptions);
  public constructor(fromClone: FromClone);
  public constructor(options: MongoSourceOptions | FromClone) {
    this.logger = options.logger.child(["MongoSource"]);
    this.database = options.database;
    this.namespace = options.namespace;

    if ("_mode" in options && options._mode === "from_clone") {
      const opts = options as FromClone;

      this.client = opts.client;
      this.entities = opts.entities;
      this.files = opts.files;
    } else {
      const opts = options as MongoSourceOptions;

      this.client = opts.config
        ? new MongoClient(opts.url, opts.config)
        : new MongoClient(opts.url);

      this.entities = opts.entities ? EntityScanner.scan(opts.entities) : [];
      this.files = opts.files ? FileScanner.scan(opts.files) : [];
    }
  }

  // public

  public clone(options: CloneMongoSourceOptions = {}): IMongoSource {
    return new MongoSource({
      _mode: "from_clone",
      client: this.client,
      database: this.database,
      entities: this.entities,
      files: this.files,
      logger: options.logger ?? this.logger,
      namespace: this.namespace,
    });
  }

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

    for (const file of this.files) {
      await this.bucket(file.File).setup();
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

import {
  EntityScanner,
  EntityScannerInput,
  globalEntityMetadata,
  IEntity,
} from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { Collection, Db, Document, MongoClient } from "mongodb";
import { MongoSourceError } from "../errors";
import { IMongoBucket, IMongoFile, IMongoRepository, IMongoSource } from "../interfaces";
import {
  CloneMongoSourceOptions,
  FileScannerInput,
  MongoSourceBucketOptions,
  MongoSourceOptions,
  MongoSourceRepositoryOptions,
} from "../types";
import { FromClone } from "../types/private";
import { MongoBucket } from "./MongoBucket";
import { MongoRepository } from "./MongoRepository";

export class MongoSource implements IMongoSource {
  public readonly __instanceof = "MongoSource";

  private readonly databaseName: string | undefined;
  private readonly entities: Array<Constructor<IEntity>>;
  private readonly files: Array<Constructor<IMongoFile>>;
  private readonly logger: ILogger;
  private readonly namespace: string | undefined;

  public readonly client: MongoClient;

  public constructor(options: MongoSourceOptions);
  public constructor(options: FromClone);
  public constructor(options: MongoSourceOptions | FromClone) {
    this.logger = options.logger.child(["MongoSource"]);
    this.databaseName = options.database;
    this.namespace = options.namespace;

    if ("_mode" in options && options._mode === "from_clone") {
      this.client = options.client;
      this.entities = options.entities;
      this.files = options.files;
    } else {
      const opts = options as MongoSourceOptions;

      this.client = opts.config
        ? new MongoClient(opts.url, opts.config)
        : new MongoClient(opts.url);

      this.entities = opts.entities ? EntityScanner.scan<IEntity>(opts.entities) : [];
      this.files = opts.files ? EntityScanner.scan<IMongoFile>(opts.files) : [];
    }
  }

  // public

  public clone(options: CloneMongoSourceOptions = {}): IMongoSource {
    return new MongoSource({
      _mode: "from_clone",
      client: this.client,
      database: this.databaseName,
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

  public async ping(): Promise<void> {
    try {
      await this.client.db().admin().ping();
      this.logger.debug("Ping successful", { context: "MongoSource" });
    } catch (error: any) {
      throw new MongoSourceError("Ping failed", { error });
    }
  }

  public async setup(): Promise<void> {
    await this.client.connect();

    for (const entity of this.entities) {
      await this.repository(entity).setup();
    }

    for (const file of this.files) {
      await this.bucket(file).setup();
    }
  }

  public get database(): Db {
    if (!this.databaseName) {
      throw new MongoSourceError("Database name not set");
    }
    return this.client.db(this.databaseName);
  }

  public addEntities(entities: EntityScannerInput): void {
    this.entities.push(
      ...EntityScanner.scan(entities).filter((Entity) => !this.entities.includes(Entity)),
    );
  }

  public addFiles(files: FileScannerInput): void {
    this.files.push(
      ...EntityScanner.scan(files).filter((Entity) => !this.files.includes(Entity)),
    );
  }

  public hasEntity(target: Constructor<IEntity>): boolean {
    return this.entities.some((Entity) => Entity === target);
  }

  public hasFile(target: Constructor<IMongoFile>): boolean {
    return this.files.some((File) => File === target);
  }

  public collection<D extends Document>(name: string): Collection<D> {
    return this.database.collection(name);
  }

  public bucket<F extends IMongoFile>(
    File: Constructor<F>,
    options: MongoSourceBucketOptions = {},
  ): IMongoBucket<F> {
    this.fileExists(File);

    return new MongoBucket({
      File,
      client: this.client,
      database: this.databaseName,
      logger: options.logger ?? this.logger,
      namespace: this.namespace,
    });
  }

  public repository<E extends IEntity>(
    Entity: Constructor<E>,
    options: MongoSourceRepositoryOptions = {},
  ): IMongoRepository<E> {
    this.entityExists(Entity);

    return new MongoRepository({
      target: Entity,
      client: this.client,
      database: this.databaseName,
      logger: options.logger ?? this.logger,
      namespace: this.namespace,
    });
  }

  // private

  private entityExists<E extends IEntity>(Entity: Constructor<E>): void {
    const config = this.entities.find((e) => e === Entity);

    if (!config) {
      throw new MongoSourceError("Entity not found in entities list", {
        debug: { Entity },
      });
    }

    const metadata = globalEntityMetadata.get(Entity);

    if (metadata.entity.decorator !== "Entity") {
      throw new MongoSourceError(`Entity is not decorated with @Entity`, {
        debug: { Entity },
      });
    }
  }

  private fileExists<E extends IMongoFile>(File: Constructor<E>): void {
    const config = this.files.find((e) => e === File);

    if (!config) {
      throw new MongoSourceError("File not found in entities list", { debug: { File } });
    }

    const metadata = globalEntityMetadata.get(File);

    if (metadata.entity.decorator !== "File") {
      throw new MongoSourceError(`File is not decorated with @File`, { debug: { File } });
    }
  }
}

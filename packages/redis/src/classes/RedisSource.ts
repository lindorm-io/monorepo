import { isString } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { ScanData, Scanner } from "@lindorm/scanner";
import { Constructor, Dict } from "@lindorm/types";
import { Redis } from "ioredis";
import { RedisError } from "../errors";
import {
  IRedisEntity,
  IRedisRepository,
  IRedisSource,
  SourceRepositoryOptions,
} from "../interfaces";
import { RedisSourceOptions } from "../types";
import { RedisRepository } from "./RedisRepository";

export class RedisSource implements IRedisSource {
  private readonly entities: Array<Constructor<IRedisEntity>>;
  private readonly logger: ILogger;
  private readonly scanner: Scanner;
  private readonly namespace: string | undefined;
  private readonly useCache: boolean | undefined;

  public readonly redis: Redis;

  public constructor(options: RedisSourceOptions) {
    this.logger = options.logger;
    this.namespace = options.namespace;
    this.useCache = options.useCache;

    this.redis = options.config
      ? new Redis(options.url, options.config)
      : new Redis(options.url);

    this.scanner = new Scanner({
      deniedFilenames: [/^index$/],
      deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
    });

    this.entities = this.scan(options);
  }

  // public

  public async connect(): Promise<void> {
    await this.redis.connect();
  }

  public async disconnect(): Promise<void> {
    await this.redis.quit();
  }

  public repository<T extends IRedisEntity>(
    Entity: Constructor<T>,
    options: SourceRepositoryOptions = {},
  ): IRedisRepository<T> {
    this.verify(Entity);

    return new RedisRepository({
      Entity,
      logger: this.logger,
      namespace: this.namespace,
      redis: this.redis,
      useCache: options.useCache ?? this.useCache,
    });
  }

  // private

  private verify(Entity: Constructor<IRedisEntity>): void {
    if (this.entities.find((entity) => entity === Entity)) return;

    throw new RedisError(`Entity not found in entities list`);
  }

  private scan(options: RedisSourceOptions): Array<Constructor<IRedisEntity>> {
    const result: Array<Constructor<IRedisEntity>> = [];

    const entities = options.entities.filter((entity) => !isString(entity)) as Array<
      Constructor<IRedisEntity>
    >;

    result.push(...entities);

    const strings = options.entities.filter((entity) =>
      isString(entity),
    ) as Array<string>;

    if (!strings.length) return result;

    for (const path of strings) {
      const item = this.scanner.scan(path);

      if (item.isDirectory) {
        result.push(...this.scanDirectory(item));
      }
      if (item.isFile) {
        result.push(this.scanFile(item));
      }
    }

    return result;
  }

  private scanDirectory(data: ScanData): Array<Constructor<IRedisEntity>> {
    const result: Array<Constructor<IRedisEntity>> = [];

    for (const child of data.children) {
      if (child.isDirectory) {
        result.push(...this.scanDirectory(child));
      }
      if (child.isFile) {
        result.push(this.scanFile(child));
      }
    }

    return result;
  }

  private scanFile(data: ScanData): Constructor<IRedisEntity> {
    const module = this.scanner.require<Dict>(data.fullPath);
    const values = Object.values(module);

    if (values.length === 0) {
      throw new RedisError(`No entities found in file: ${data.fullPath}`);
    }

    if (values.length === 1 && values.includes("default")) {
      throw new RedisError(`No default export allowed for class: ${data.fullPath}`);
    }

    for (const value of values) {
      if (value.default) continue;

      return value as Constructor<IRedisEntity>;
    }

    throw new RedisError(`No entities found in file: ${data.fullPath}`);
  }
}

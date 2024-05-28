import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
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
import { EntityScanner } from "./private";

export class RedisSource implements IRedisSource {
  private readonly entities: Array<Constructor<IRedisEntity>>;
  private readonly logger: ILogger;
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

    this.entities = new EntityScanner().scan(options.entities);
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
}

import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { Redis } from "ioredis";
import { RedisRepositoryError } from "../errors";
import {
  IRedisEntity,
  IRedisRepository,
  IRedisSource,
  RedisSourceRepositoryOptions,
} from "../interfaces";
import { RedisSourceEntity, RedisSourceOptions } from "../types";
import { RedisRepository } from "./RedisRepository";
import { EntityScanner } from "./private";

export class RedisSource implements IRedisSource {
  private readonly entities: Array<RedisSourceEntity>;
  private readonly logger: ILogger;
  private readonly namespace: string | undefined;

  public readonly client: Redis;

  public constructor(options: RedisSourceOptions) {
    this.logger = options.logger.child(["RedisSource"]);
    this.namespace = options.namespace;

    this.client = options.config
      ? new Redis(options.url, options.config)
      : new Redis(options.url);

    this.entities = new EntityScanner().scan(options.entities);
  }

  // public

  public async connect(): Promise<void> {
    await this.client.connect();
  }

  public async disconnect(): Promise<void> {
    await this.client.quit();
  }

  public repository<E extends IRedisEntity>(
    Entity: Constructor<E>,
    options: RedisSourceRepositoryOptions<E> = {},
  ): IRedisRepository<E> {
    const config = this.config(Entity);

    return new RedisRepository({
      Entity,
      client: this.client,
      logger: options.logger ?? this.logger,
      namespace: this.namespace,
      validate: options.validate ?? config.validate,
    });
  }

  public async setup(): Promise<void> {
    await this.client.connect();
  }

  // private

  private config(Entity: Constructor<IRedisEntity>): RedisSourceEntity {
    const config = this.entities.find((entity) => entity.Entity === Entity);

    if (config) {
      return config;
    }

    throw new RedisRepositoryError(`Entity not found in entities list`);
  }
}

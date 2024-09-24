import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { Redis } from "ioredis";
import { RedisSourceError } from "../errors";
import {
  IRedisEntity,
  IRedisRepository,
  IRedisSource,
  RedisSourceRepositoryOptions,
} from "../interfaces";
import { RedisSourceEntity, RedisSourceOptions } from "../types";
import { FromClone } from "../types/private";
import { RedisRepository } from "./RedisRepository";
import { EntityScanner } from "./private";

export class RedisSource implements IRedisSource {
  private readonly entities: Array<RedisSourceEntity>;
  private readonly logger: ILogger;
  private readonly namespace: string | undefined;

  public readonly client: Redis;

  public constructor(options: RedisSourceOptions);
  public constructor(options: FromClone);
  public constructor(options: RedisSourceOptions | FromClone) {
    this.logger = options.logger.child(["RedisSource"]);
    this.namespace = options.namespace;

    if ("_mode" in options && options._mode === "from_clone") {
      const opts = options as FromClone;

      this.client = opts.client;
      this.entities = opts.entities;
    } else {
      const opts = options as RedisSourceOptions;

      this.client = opts.config ? new Redis(opts.url, opts.config) : new Redis(opts.url);
      this.entities = EntityScanner.scan(opts.entities);
    }
  }

  // public

  public clone(logger?: ILogger): IRedisSource {
    return new RedisSource({
      _mode: "from_clone",
      client: this.client,
      entities: this.entities,
      logger: logger ?? this.logger,
      namespace: this.namespace,
    });
  }

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

    throw new RedisSourceError("Entity not found in entities list", {
      debug: { Entity },
    });
  }
}

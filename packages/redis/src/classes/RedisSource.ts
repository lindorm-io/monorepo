import {
  EntityScanner,
  EntityScannerInput,
  globalEntityMetadata,
  IEntity,
} from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { Redis } from "ioredis";
import { RedisSourceError } from "../errors";
import { IRedisRepository, IRedisSource } from "../interfaces";
import {
  CloneRedisSourceOptions,
  RedisSourceOptions,
  RedisSourceRepositoryOptions,
} from "../types";
import { FromClone } from "../types/private";
import { RedisRepository } from "./RedisRepository";

export class RedisSource implements IRedisSource {
  private readonly entities: Array<Constructor<IEntity>>;
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

      this.entities = opts.entities ? EntityScanner.scan<IEntity>(opts.entities) : [];
    }
  }

  // public

  public clone(options: CloneRedisSourceOptions = {}): IRedisSource {
    return new RedisSource({
      _mode: "from_clone",
      client: this.client,
      entities: this.entities,
      logger: options.logger ?? this.logger,
      namespace: this.namespace,
    });
  }

  public async connect(): Promise<void> {
    if (this.client.status === "ready") return;
    if (this.client.status === "connecting") return;
    if (this.client.status === "reconnecting") return;

    await this.client.connect();
  }

  public async disconnect(): Promise<void> {
    await this.client.quit();
  }

  public async setup(): Promise<void> {
    await this.connect();

    for (const Entity of this.entities) {
      await this.repository(Entity).setup();
    }
  }

  public addEntities(entities: EntityScannerInput): void {
    this.entities.push(...EntityScanner.scan(entities));
  }

  public repository<E extends IEntity>(
    Entity: Constructor<E>,
    options: RedisSourceRepositoryOptions = {},
  ): IRedisRepository<E> {
    this.entityExists(Entity);

    return new RedisRepository({
      Entity,
      client: this.client,
      logger: options.logger ?? this.logger,
      namespace: this.namespace,
    });
  }

  // private

  private entityExists<E extends IEntity>(Entity: Constructor<E>): void {
    const config = this.entities.find((e) => e === Entity);

    if (!config) {
      throw new RedisSourceError("Entity not found in entities list", {
        debug: { Entity },
      });
    }

    const metadata = globalEntityMetadata.get(Entity);

    if (metadata.entity.decorator !== "Entity") {
      throw new RedisSourceError(`Entity is not decorated with @Entity`, {
        debug: { Entity },
      });
    }
  }
}

import { IEntity } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { MnemosSourceError } from "../errors";
import {
  IMnemosCache,
  IMnemosRepository,
  IMnemosSource,
  MnemosSourceRepositoryOptions,
} from "../interfaces";
import {
  CloneMnemosSourceOptions,
  MnemosSourceEntities,
  MnemosSourceEntity,
  MnemosSourceOptions,
} from "../types";
import { FromClone } from "../types/private";
import { MnemosCache } from "./MnemosCache";
import { MnemosRepository } from "./MnemosRepository";
import { EntityScanner } from "./private";

export class MnemosSource implements IMnemosSource {
  private readonly entities: Array<MnemosSourceEntity>;
  private readonly logger: ILogger;

  public readonly client: IMnemosCache;

  public constructor(options: MnemosSourceOptions);
  public constructor(options: FromClone);
  public constructor(options: MnemosSourceOptions | FromClone) {
    this.logger = options.logger.child(["MnemosSource"]);

    if ("_mode" in options && options._mode === "from_clone") {
      const opts = options as FromClone;

      this.client = opts.client;
      this.entities = opts.entities;
    } else {
      const opts = options as MnemosSourceOptions;

      this.client = new MnemosCache();
      this.entities = opts.entities ? EntityScanner.scan(opts.entities) : [];
    }
  }

  // public

  public addEntities(entities: MnemosSourceEntities): void {
    this.entities.push(...EntityScanner.scan(entities));
  }

  public clone(options: CloneMnemosSourceOptions = {}): IMnemosSource {
    return new MnemosSource({
      _mode: "from_clone",
      client: this.client,
      entities: this.entities,
      logger: options.logger ?? this.logger,
    });
  }

  public repository<E extends IEntity>(
    Entity: Constructor<E>,
    options: MnemosSourceRepositoryOptions<E> = {},
  ): IMnemosRepository<E> {
    const config = this.entityConfig(Entity);

    return new MnemosRepository({
      Entity,
      cache: this.client,
      logger: options.logger ?? this.logger,
      create: options.create ?? config.create,
      validate: options.validate ?? config.validate,
    });
  }

  // private

  private entityConfig<E extends IEntity>(Entity: Constructor<E>): MnemosSourceEntity<E> {
    const config = this.entities.find((entity) => entity.Entity === Entity);

    if (config) {
      return config as unknown as MnemosSourceEntity<E>;
    }

    throw new MnemosSourceError("Entity not found in entities list", {
      debug: { Entity },
    });
  }
}

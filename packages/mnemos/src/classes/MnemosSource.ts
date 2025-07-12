import {
  EntityScanner,
  EntityScannerInput,
  globalEntityMetadata,
  IEntity,
} from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { MnemosSourceError } from "../errors";
import { IMnemosCache, IMnemosRepository, IMnemosSource } from "../interfaces";
import {
  CloneMnemosSourceOptions,
  MnemosSourceOptions,
  MnemosSourceRepositoryOptions,
} from "../types";
import { FromClone } from "../types/private";
import { MnemosCache } from "./MnemosCache";
import { MnemosRepository } from "./MnemosRepository";

export class MnemosSource implements IMnemosSource {
  public readonly name = "MnemosSource";

  private readonly entities: Array<Constructor<IEntity>>;
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

  public addEntities(entities: EntityScannerInput): void {
    this.entities.push(
      ...EntityScanner.scan(entities).filter((Entity) => !this.entities.includes(Entity)),
    );
  }

  public clone(options: CloneMnemosSourceOptions = {}): IMnemosSource {
    return new MnemosSource({
      _mode: "from_clone",
      client: this.client,
      entities: this.entities,
      logger: options.logger ?? this.logger,
    });
  }

  public repository<E extends IEntity = IEntity>(
    Entity: Constructor<E>,
    options: MnemosSourceRepositoryOptions = {},
  ): IMnemosRepository<E> {
    this.configExists(Entity);

    return new MnemosRepository({
      target: Entity,
      cache: this.client,
      logger: options.logger ?? this.logger,
      namespace: options.namespace,
    });
  }

  // private

  private configExists<E extends IEntity>(Entity: Constructor<E>): void {
    const config = this.entities.find((e) => e === Entity);

    if (!config) {
      throw new MnemosSourceError("Entity not found in entities list", {
        debug: { Entity },
      });
    }

    const metadata = globalEntityMetadata.get(Entity);

    if (metadata.entity.decorator !== "Entity") {
      throw new MnemosSourceError(`Entity is not decorated with @Entity`, {
        debug: { Entity },
      });
    }
  }
}

import { Client } from "@elastic/elasticsearch";
import {
  EntityScanner,
  EntityScannerInput,
  globalEntityMetadata,
  IEntity,
} from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { sleep } from "@lindorm/utils";
import { ElasticSourceError } from "../errors";
import { IElasticRepository, IElasticSource } from "../interfaces";
import {
  CloneElasticSourceOptions,
  ElasticSourceOptions,
  ElasticSourceRepositoryOptions,
} from "../types";
import { FromClone } from "../types/private";
import { ElasticRepository } from "./ElasticRepository";

export class ElasticSource implements IElasticSource {
  private readonly entities: Array<Constructor<IEntity>>;
  private readonly logger: ILogger;
  private readonly namespace: string | undefined;

  public readonly client: Client;

  public constructor(options: ElasticSourceOptions);
  public constructor(options: FromClone);
  public constructor(options: ElasticSourceOptions | FromClone) {
    this.logger = options.logger.child(["ElasticSource"]);
    this.namespace = options.namespace;

    if ("_mode" in options && options._mode === "from_clone") {
      const opts = options as FromClone;

      this.client = opts.client;
      this.entities = opts.entities;
    } else {
      const opts = options as ElasticSourceOptions;
      const config = opts.config ?? {};

      this.client = new Client({ node: opts.url, ...config });
      this.entities = opts.entities ? EntityScanner.scan(opts.entities) : [];
    }
  }

  // public

  public clone(options: CloneElasticSourceOptions = {}): IElasticSource {
    return new ElasticSource({
      _mode: "from_clone",
      client: this.client,
      entities: this.entities,
      logger: options.logger ?? this.logger,
      namespace: this.namespace,
      ...options,
    });
  }

  public async connect(): Promise<void> {
    try {
      await this.client.ping();
    } catch (err: any) {
      this.logger.warn("Failed to connect to ElasticSearch", err);
      await sleep(1000);
      return this.connect();
    }
  }

  public async disconnect(): Promise<void> {
    await this.client.close();
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
    options: ElasticSourceRepositoryOptions = {},
  ): IElasticRepository<E> {
    this.entityExists(Entity);

    return new ElasticRepository({
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
      throw new ElasticSourceError("Entity not found in entities list", {
        debug: { Entity },
      });
    }

    const metadata = globalEntityMetadata.get(Entity);

    if (metadata.entity.decorator !== "Entity") {
      throw new ElasticSourceError(`Entity is not decorated with @Entity`, {
        debug: { Entity },
      });
    }
  }
}

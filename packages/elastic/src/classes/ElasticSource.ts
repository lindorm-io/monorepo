import { Client } from "@elastic/elasticsearch";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { sleep } from "@lindorm/utils";
import { ElasticSourceError } from "../errors";
import { IElasticEntity, IElasticRepository, IElasticSource } from "../interfaces";
import {
  CloneElasticSourceOptions,
  ElasticSourceEntities,
  ElasticSourceEntity,
  ElasticSourceOptions,
  ElasticSourceRepositoryOptions,
} from "../types";
import { FromClone } from "../types/private";
import { ElasticRepository } from "./ElasticRepository";
import { EntityScanner } from "./private";

export class ElasticSource implements IElasticSource {
  private readonly entities: Array<ElasticSourceEntity>;
  private readonly logger: ILogger;
  private readonly namespace: string | undefined;

  public readonly client: Client;

  public constructor(options: ElasticSourceOptions);
  public constructor(fromClone: FromClone);
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

  public addEntities(entities: ElasticSourceEntities): void {
    this.entities.push(...EntityScanner.scan(entities));
  }

  public clone(options: CloneElasticSourceOptions = {}): IElasticSource {
    return new ElasticSource({
      _mode: "from_clone",
      client: this.client,
      entities: this.entities,
      logger: this.logger,
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

  public repository<E extends IElasticEntity>(
    Entity: Constructor<E>,
    options: ElasticSourceRepositoryOptions<E> = {},
  ): IElasticRepository<E> {
    const config = this.entityConfig(Entity);

    return new ElasticRepository({
      Entity,
      client: this.client,
      config: options.config ?? config.config,
      create: options.create ?? config.create,
      logger: this.logger,
      mappings: options.mappings ?? config.mappings,
      namespace: this.namespace,
      validate: options.validate ?? config.validate,
    });
  }

  public async setup(): Promise<void> {
    await this.connect();

    for (const entity of this.entities) {
      await this.repository(entity.Entity).setup();
    }
  }

  // private

  private entityConfig<E extends IElasticEntity>(
    Entity: Constructor<E>,
  ): ElasticSourceEntity<E> {
    const config = this.entities.find((entity) => entity.Entity === Entity);

    if (config) {
      return config as ElasticSourceEntity<E>;
    }

    throw new ElasticSourceError("Entity not found in entities list", {
      debug: { Entity },
    });
  }
}

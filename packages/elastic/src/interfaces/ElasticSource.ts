import { Client } from "@elastic/elasticsearch";
import { EntityScannerInput, IEntity } from "@lindorm/entity";
import { Constructor } from "@lindorm/types";
import { CloneElasticSourceOptions, ElasticSourceRepositoryOptions } from "../types";
import { IElasticRepository } from "./ElasticRepository";

export interface IElasticSource {
  client: Client;

  clone(options?: CloneElasticSourceOptions): IElasticSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setup(): Promise<void>;

  addEntities(entities: EntityScannerInput): void;
  repository<E extends IEntity>(
    Entity: Constructor<E>,
    options?: ElasticSourceRepositoryOptions,
  ): IElasticRepository<E>;
}

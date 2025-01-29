import { Client } from "@elastic/elasticsearch";
import { IEntityBase } from "@lindorm/entity";
import { Constructor } from "@lindorm/types";
import {
  CloneElasticSourceOptions,
  ElasticSourceEntities,
  ElasticSourceRepositoryOptions,
} from "../types";
import { IElasticRepository } from "./ElasticRepository";

export interface IElasticSource {
  client: Client;

  addEntities(entities: ElasticSourceEntities): void;
  clone(options?: CloneElasticSourceOptions): IElasticSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  repository<E extends IEntityBase>(
    Entity: Constructor<E>,
    options?: ElasticSourceRepositoryOptions<E>,
  ): IElasticRepository<E>;
  setup(): Promise<void>;
}

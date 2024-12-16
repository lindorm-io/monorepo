import { Client } from "@elastic/elasticsearch";
import { Constructor } from "@lindorm/types";
import {
  CloneElasticSourceOptions,
  ElasticSourceEntities,
  ElasticSourceRepositoryOptions,
} from "../types";
import { IElasticEntity } from "./ElasticEntity";
import { IElasticRepository } from "./ElasticRepository";

export interface IElasticSource {
  client: Client;

  addEntities(entities: ElasticSourceEntities): void;
  clone(options?: CloneElasticSourceOptions): IElasticSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  repository<E extends IElasticEntity>(
    Entity: Constructor<E>,
    options?: ElasticSourceRepositoryOptions<E>,
  ): IElasticRepository<E>;
  setup(): Promise<void>;
}

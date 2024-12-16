import { Client } from "@elastic/elasticsearch";
import { MappingTypeMapping } from "@elastic/elasticsearch/lib/api/types";
import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { IElasticEntity } from "../interfaces";
import { ElasticEntityConfig } from "./elastic-entity-config";

export type CreateElasticEntityFn<E extends IElasticEntity = IElasticEntity> = (
  options: DeepPartial<E>,
) => E;

export type ValidateElasticEntityFn<E extends IElasticEntity = IElasticEntity> = (
  entity: Omit<
    E,
    | "id"
    | "primaryTerm"
    | "rev"
    | "seq"
    | "createdAt"
    | "updatedAt"
    | "deletedAt"
    | "expiresAt"
  >,
) => void;

export type ElasticRepositoryOptions<E extends IElasticEntity> = {
  Entity: Constructor<E>;
  client: Client;
  config?: ElasticEntityConfig;
  create?: CreateElasticEntityFn<E>;
  logger: ILogger;
  mappings?: MappingTypeMapping;
  namespace?: string;
  validate?: ValidateElasticEntityFn<E>;
};

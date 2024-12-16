import { ClientOptions } from "@elastic/elasticsearch";
import { MappingTypeMapping } from "@elastic/elasticsearch/lib/api/types";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { IElasticEntity } from "../interfaces";
import { ElasticEntityConfig } from "./elastic-entity-config";
import { CreateElasticEntityFn, ValidateElasticEntityFn } from "./elastic-repository";

export type ElasticSourceEntity<E extends IElasticEntity = IElasticEntity> = {
  Entity: Constructor<E>;
  config?: ElasticEntityConfig;
  mappings?: MappingTypeMapping;
  create?: CreateElasticEntityFn<E>;
  validate?: ValidateElasticEntityFn<E>;
};

export type ElasticSourceEntities = Array<
  Constructor<IElasticEntity> | ElasticSourceEntity | string
>;

export type ElasticSourceRepositoryOptions<E extends IElasticEntity> = {
  config?: ElasticEntityConfig;
  create?: CreateElasticEntityFn<E>;
  logger?: ILogger;
  mappings?: MappingTypeMapping;
  validate?: ValidateElasticEntityFn<E>;
};

export type CloneElasticSourceOptions = {
  logger?: ILogger;
};

export type ElasticSourceOptions = {
  config?: ClientOptions;
  entities?: ElasticSourceEntities;
  logger: ILogger;
  namespace?: string;
  url: string;
};

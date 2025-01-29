import { ClientOptions } from "@elastic/elasticsearch";
import { MappingTypeMapping } from "@elastic/elasticsearch/lib/api/types";
import { IEntityBase } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import {
  CreateElasticEntityFn,
  ElasticEntityConfig,
  ValidateElasticEntityFn,
} from "./elastic-entity";

export type ElasticSourceEntity<E extends IEntityBase = IEntityBase> = {
  Entity: Constructor<E>;
  config?: ElasticEntityConfig<E>;
  mappings?: MappingTypeMapping;
  create?: CreateElasticEntityFn<E>;
  validate?: ValidateElasticEntityFn<E>;
};

export type ElasticSourceEntities = Array<
  Constructor<IEntityBase> | ElasticSourceEntity | string
>;

export type ElasticSourceRepositoryOptions<E extends IEntityBase> = {
  config?: ElasticEntityConfig<E>;
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

import { Client } from "@elastic/elasticsearch";
import { MappingTypeMapping } from "@elastic/elasticsearch/lib/api/types";
import { IEntityBase } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import {
  CreateElasticEntityFn,
  ElasticEntityConfig,
  ValidateElasticEntityFn,
} from "./elastic-entity";

export type ElasticRepositoryOptions<E extends IEntityBase> = {
  Entity: Constructor<E>;
  client: Client;
  config?: ElasticEntityConfig<E>;
  create?: CreateElasticEntityFn<E>;
  logger: ILogger;
  mappings?: MappingTypeMapping;
  namespace?: string;
  validate?: ValidateElasticEntityFn<E>;
};

import { ClientOptions } from "@elastic/elasticsearch";
import { EntityScannerInput, IEntity } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";

export type ElasticSourceRepositoryOptions = {
  logger?: ILogger;
};

export type CloneElasticSourceOptions = {
  logger?: ILogger;
};

export type ElasticSourceOptions = {
  config?: ClientOptions;
  entities?: EntityScannerInput<IEntity>;
  logger: ILogger;
  namespace?: string;
  url: string;
};

import { Client } from "@elastic/elasticsearch";
import { IEntity } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";

export type ElasticRepositoryOptions<E extends IEntity> = {
  Entity: Constructor<E>;
  client: Client;
  logger: ILogger;
  namespace?: string;
};

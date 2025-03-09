import { Client } from "@elastic/elasticsearch";
import { IEntity } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";

export type FromClone = {
  _mode: "from_clone";
  client: Client;
  entities: Array<Constructor<IEntity>>;
  logger: ILogger;
  namespace: string | undefined;
};

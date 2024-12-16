import { Client } from "@elastic/elasticsearch";
import { ILogger } from "@lindorm/logger";
import { ElasticSourceEntity } from "../elastic-source";

export type FromClone = {
  _mode: "from_clone";
  client: Client;
  entities: Array<ElasticSourceEntity>;
  logger: ILogger;
  namespace: string | undefined;
};

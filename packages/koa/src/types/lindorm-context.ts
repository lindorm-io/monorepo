import { Logger } from "@lindorm-io/core-logger";

export interface DefaultLindormContext {
  axios: any;
  cache: any;
  connection: any;
  entity: any;
  eventSource: any;
  jwt: any;
  keys: Array<any>;
  keystore: any;
  logger: Logger;
  messageBus: any;
  repository: any;
  token: any;
}

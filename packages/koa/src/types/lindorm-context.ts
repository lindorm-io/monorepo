import { Logger } from "@lindorm-io/core-logger";

export interface DefaultLindormContext {
  axios: any;
  connection: any;
  entity: any;
  eventSource: any;
  jwt: any;
  keys: Array<any>;
  keystore: any;
  logger: Logger;
  memory: any;
  messageBus: any;
  mongo: any;
  redis: any;
  token: any;
}

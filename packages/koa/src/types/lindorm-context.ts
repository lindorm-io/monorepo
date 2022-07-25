import { ILogger } from "@lindorm-io/winston";

export interface DefaultLindormContext {
  axios: any;
  cache: any;
  connection: any;
  entity: any;
  eventDomain: any;
  jwt: any;
  keys: Array<any>;
  keystore: any;
  logger: ILogger;
  messageBus: any;
  repository: any;
  token: any;
}

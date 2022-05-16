import { Logger } from "@lindorm-io/winston";

export interface DefaultLindormContext {
  axios: any;
  cache: any;
  connection: any;
  entity: any;
  jwt: any;
  keys: Array<any>;
  keystore: any;
  logger: Logger;
  repository: any;
  token: any;
}

import { Logger } from "@lindorm-io/winston";

export interface DefaultLindormContext {
  axios: Record<string, any>;
  cache: Record<string, any>;
  connection: Record<string, any>;
  entity: Record<string, any>;
  jwt: unknown;
  keys: Array<unknown>;
  keystore: unknown;
  logger: Logger;
  repository: Record<string, any>;
  token: Record<string, any>;
}

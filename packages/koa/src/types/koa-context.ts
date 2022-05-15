import { AuthorizationHeader } from "./authorization-header";
import { Environment } from "../enum";
import { GetCookieOptions, SetCookieOptions } from "../util/private";
import { LindormKoaMetadata, LindormKoaMetadataHeaders } from "./metadata";
import { Logger } from "@lindorm-io/winston";
import { Metric } from "../class";
import { RouterContext } from "koa-router";

export interface DefaultLindormKoaContext<
  RequestData extends Record<string, any> = Record<string, any>,
> extends RouterContext {
  axios: Record<string, any>;
  cache: Record<string, any>;
  connection: Record<string, any>;
  data: RequestData;
  entity: Record<string, any>;
  jwt: unknown;
  keys: Array<unknown>;
  keystore: unknown;
  logger: Logger;
  metadata: LindormKoaMetadata;
  metrics: Record<string, number>;
  repository: Record<string, any>;
  server: {
    domain: string;
    environment: Environment;
    host: string;
  };
  token: Record<string, any>;
  getAuthorizationHeader(): AuthorizationHeader;
  getMetadataHeaders(): LindormKoaMetadataHeaders;
  getMetric(key: string): Metric;
  getCookie(name: string, options?: Partial<GetCookieOptions>): string | undefined;
  setCookie(name: string, value: string, options?: Partial<SetCookieOptions>): void;
  deleteCookie(name: string): void;
}

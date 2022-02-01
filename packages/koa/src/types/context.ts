import { Environment } from "../enum";
import { KoaMetadata, KoaMetadataHeaders } from "./metadata";
import { Logger } from "@lindorm-io/winston";
import { Metric } from "../class";
import { Request, Response } from "koa";
import { RouterContext } from "koa-router";
import { AuthorizationHeader, RecordAny, RecordNumber, RecordString } from "./util";

interface KoaRequest<Body extends RecordAny> extends Request {
  body: Body;
}

interface KoaResponse<Body> extends Response {
  body: Body;
}

export interface KoaContext<RequestData extends RecordString = RecordAny, ResponseBody = any>
  extends RouterContext {
  axios: RecordAny;
  cache: RecordAny;
  connection: RecordAny;
  entity: RecordAny;
  jwt: unknown;
  keys: Array<unknown>;
  keystore: unknown;
  logger: Logger;
  metadata: KoaMetadata;
  metrics: RecordNumber;
  repository: RecordAny;
  server: {
    domain: string;
    environment: Environment;
  };
  token: RecordAny;

  body: ResponseBody;
  data: RequestData;
  params: RecordString;
  query: RecordString;
  request: KoaRequest<RecordAny>;
  response: KoaResponse<ResponseBody>;

  getAuthorizationHeader(): AuthorizationHeader;
  getMetadataHeaders(): KoaMetadataHeaders;
  getMetric(key: string): Metric;
  getCookie(name: string): string | undefined;
  setCookie(name: string, value: string, expiry?: Date | number): void;
  deleteCookie(name: string): void;
}

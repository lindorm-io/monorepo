import { ReadableTime } from "@lindorm/date";
import { HttpMethod } from "@lindorm/enums";
import { EmbedderPolicy, OpenerPolicy } from "../enums";

export type CorsOptions = {
  allowCredentials?: boolean;
  allowHeaders?: "*" | Array<string>;
  allowMethods?: "*" | Array<HttpMethod>;
  allowOrigins?: "*" | Array<string>;
  embedderPolicy?: EmbedderPolicy;
  exposeHeaders?: Array<string>;
  maxAge?: ReadableTime | number;
  openerPolicy?: OpenerPolicy;
  privateNetworkAccess?: boolean;
};

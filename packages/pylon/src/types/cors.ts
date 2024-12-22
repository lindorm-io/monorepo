import { ReadableTime } from "@lindorm/date";
import { HttpMethod } from "@lindorm/enums";
import { EmbedderPolicy, OpenerPolicy } from "../enums";
import { PylonHttpContext, PylonHttpMiddleware } from "./pylon-context";

export type CorsContext = PylonHttpContext & {
  preflight: boolean;
};

export type CorsMiddleware = PylonHttpMiddleware<CorsContext>;

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

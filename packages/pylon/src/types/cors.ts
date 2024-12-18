import { ReadableTime } from "@lindorm/date";
import { HttpMethod } from "@lindorm/enums";
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
  embedderPolicy?: "credentialless" | "require-corp";
  exposeHeaders?: Array<string>;
  maxAge?: ReadableTime | number;
  openerPolicy?: "unsafe-none" | "same-origin" | "same-origin-allow-popups";
  privateNetworkAccess?: boolean;
};

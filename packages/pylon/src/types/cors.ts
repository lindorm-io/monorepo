import { ReadableTime } from "@lindorm/date";
import { HttpMethod } from "@lindorm/types";

export type EmbedderPolicy = "credentialless" | "require-corp" | "unsafe-none";

export type OpenerPolicy = "same-origin" | "same-origin-allow-popups" | "unsafe-none";

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

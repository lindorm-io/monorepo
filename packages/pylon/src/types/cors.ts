import type { ReadableTime } from "@lindorm/date";
import type { HttpMethod } from "@lindorm/types";

export type EmbedderPolicy = "credentialless" | "require-corp" | "unsafe-none";

export type OpenerPolicy = "same-origin" | "same-origin-allow-popups" | "unsafe-none";

export type CorsOptions = {
  allowCredentials?: boolean;
  /**
   * Allowed request headers.
   * - `"*"` matches every request header **except `Authorization`** (which must
   *   be named explicitly even with the wildcard), and only applies when the
   *   request carries no credentials.
   * - An array is canonicalised: CORS-safelisted headers are stripped (with a
   *   WARN), `content-type` is auto-injected exactly once (it is not safelisted
   *   for `application/json`), and the list is de-duplicated.
   */
  allowHeaders?: "*" | Array<string>;
  allowMethods?: "*" | Array<HttpMethod>;
  allowOrigins?: "*" | Array<string>;
  embedderPolicy?: EmbedderPolicy;
  exposeHeaders?: Array<string>;
  maxAge?: ReadableTime | number;
  openerPolicy?: OpenerPolicy;
  privateNetworkAccess?: boolean;
};

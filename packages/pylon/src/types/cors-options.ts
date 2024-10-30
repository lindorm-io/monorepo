import { ReadableTime } from "@lindorm/date";
import { HttpMethod } from "@lindorm/enums";

export type CorsOptions = {
  allowCredentials?: boolean;
  allowHeaders?: "*" | Array<string>;
  allowMethods?: "*" | Array<HttpMethod>;
  allowOrigins?: "*" | Array<string>;
  exposeHeaders?: "*" | Array<string>;
  maxAge?: ReadableTime | number;
};

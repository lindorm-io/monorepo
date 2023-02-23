import { Context } from "./context";
import { Middleware as Mw } from "@lindorm-io/middleware";

export type Middleware<
  ResponseData = any,
  RequestBody = any,
  RequestParams = any,
  RequestQuery = any,
> = Mw<Context<ResponseData, RequestBody, RequestParams, RequestQuery>>;

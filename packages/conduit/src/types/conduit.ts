import { Environment } from "@lindorm/enums";
import { ILogger } from "@lindorm/logger";
import { Middleware } from "@lindorm/middleware";
import { RetryOptions } from "@lindorm/retry";
import { ConduitUsing } from "../enums";
import { AppContext, RequestContext } from "./context";
import { ConfigOptions } from "./overrides";
import { ConduitResponse } from "./response";
import { RetryCallback } from "./retry";

export type ConduitContext<
  ResponseData = any,
  RequestBody = Record<string, any>,
  RequestParams = Record<string, any>,
  RequestQuery = Record<string, any>,
> = {
  app: AppContext;
  logger?: ILogger;
  req: RequestContext<RequestBody, RequestParams, RequestQuery>;
  res: ConduitResponse<ResponseData>;
};

export type ConduitMiddleware<
  ResponseData = any,
  RequestBody = any,
  RequestParams = any,
  RequestQuery = any,
> = Middleware<ConduitContext<ResponseData, RequestBody, RequestParams, RequestQuery>>;

export type ConduitOptions = {
  alias?: string;
  baseUrl?: URL | string;
  config?: ConfigOptions;
  environment?: Environment;
  headers?: Record<string, any>;
  logger?: ILogger;
  middleware?: Array<ConduitMiddleware>;
  retryCallback?: RetryCallback;
  retryOptions?: RetryOptions;
  timeout?: number;
  using?: ConduitUsing;
  withCredentials?: boolean;
};

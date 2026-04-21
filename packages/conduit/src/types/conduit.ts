import type { ILogger } from "@lindorm/logger";
import type { Middleware } from "@lindorm/middleware";
import type { RetryOptions } from "@lindorm/retry";
import type { Dict, Environment } from "@lindorm/types";
import type { ConduitAdapter } from "./adapter.js";
import type { AppContext, RequestContext } from "./context.js";
import type { ConfigOptions } from "./overrides.js";
import type { ConduitResponse } from "./response.js";
import type { RetryCallback } from "./retry.js";

export type ConduitContext<
  ResponseData = any,
  RequestBody = Dict,
  RequestParams = Dict,
  RequestQuery = Dict,
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
  /**
   * Axios adapter to use for requests. Defaults to `"http"`. Set to
   * `"fetch"` to use axios's native-fetch adapter.
   */
  adapter?: ConduitAdapter;
  alias?: string;
  baseURL?: URL | string;
  config?: ConfigOptions;
  environment?: Environment;
  headers?: Dict;
  logger?: ILogger;
  middleware?: Array<ConduitMiddleware>;
  retryCallback?: RetryCallback;
  retryOptions?: RetryOptions;
  timeout?: number;
  withCredentials?: boolean;
};

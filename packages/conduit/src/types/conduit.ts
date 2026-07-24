import type { ILogger } from "@lindorm/logger";
import type { Middleware } from "@lindorm/middleware";
import type { RetryOptions } from "@lindorm/retry";
import type { Dict, Environment } from "@lindorm/types";
import type { ConduitAdapter } from "./adapter.js";
import type { ConduitAppContext, ConduitRequestContext } from "./context.js";
import type { ConduitLookup } from "./lookup.js";
import type { ConduitAxiosOverrides } from "./overrides.js";
import type { ConduitResponse } from "./response.js";
import type { RetryCallback } from "./retry.js";

export type ConduitContext<
  ResponseData = any,
  RequestBody = Dict,
  RequestParams = Dict,
  RequestQuery = Dict,
> = {
  app: ConduitAppContext;
  logger?: ILogger;
  req: ConduitRequestContext<RequestBody, RequestParams, RequestQuery>;
  res: ConduitResponse<ResponseData>;
};

export type ConduitMiddleware<
  ResponseData = any,
  RequestBody = any,
  RequestParams = any,
  RequestQuery = any,
> = Middleware<ConduitContext<ResponseData, RequestBody, RequestParams, RequestQuery>>;

export type ConduitSettings = {
  /**
   * Axios adapter to use for requests. Defaults to `"http"`. Set to
   * `"fetch"` to use axios's native-fetch adapter.
   */
  adapter?: ConduitAdapter;
  alias?: string;
  baseURL?: URL | string;
  config?: ConduitAxiosOverrides;
  environment?: Environment;
  headers?: Dict;
  logger?: ILogger;
  /**
   * DNS resolver hook (SSRF IP-pinning) applied to every request — forwarded to
   * the `http` adapter's `lookup`. A per-request `lookup` overrides it. See
   * {@link ConduitLookup}.
   */
  lookup?: ConduitLookup;
  middleware?: Array<ConduitMiddleware>;
  retryCallback?: RetryCallback;
  retryOptions?: RetryOptions;
  timeout?: number;
  withCredentials?: boolean;
};

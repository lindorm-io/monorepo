import { Logger } from "@lindorm-io/core-logger";
import { resolveMiddleware } from "@lindorm-io/middleware";
import { RetryOptions } from "@lindorm-io/retry";
import { createBaseUrl, extractSearchParams, getPlainUrl, getValidUrl } from "@lindorm-io/url";
import { AxiosResponse, Method } from "axios";
import { v4 as uuid } from "uuid";
import { DEFAULT_AXIOS_RESPONSE, DEFAULT_RETRY_OPTIONS, DEFAULT_TIMEOUT } from "../constant";
import {
  axiosDefaultHeadersMiddleware,
  axiosDefaultRequestLogger,
  axiosDefaultResponseLogger,
  axiosRequestHandler,
} from "../middleware/private";
import {
  AppContext,
  AxiosOptions,
  Context,
  MethodOptions,
  Middleware,
  RawAxiosRequestConfigContext,
  RequestContext,
  RequestOptions,
  RetryCallback,
} from "../types";
import { defaultRetryCallback, validateStatus } from "../util/private";

export class Axios {
  private readonly alias: string | null;
  private readonly baseURL: URL | undefined;
  private readonly config: RawAxiosRequestConfigContext;
  private readonly headers: Record<string, any>;
  private readonly logger: Logger | undefined;
  private readonly middleware: Array<Middleware>;
  private readonly retry: RetryOptions;
  private readonly retryCallback: RetryCallback;

  public constructor(options: AxiosOptions = {}, logger?: Logger) {
    this.config = {
      auth: options.auth,
      timeout: options.timeout || DEFAULT_TIMEOUT,
      validateStatus,
      withCredentials: options.withCredentials,
      ...(options.config || {}),
    };

    this.baseURL =
      options.baseURL instanceof URL
        ? options.baseURL
        : typeof options.baseURL === "string"
        ? new URL(options.baseURL)
        : options.host
        ? createBaseUrl({
            host: options.host,
            port: options.port,
          })
        : undefined;

    this.alias = options.alias || null;
    this.headers = options.headers || {};
    this.logger = logger;
    this.middleware = options.middleware || [];
    this.retry = {
      maximumAttempts: options.retry?.maximumAttempts || DEFAULT_RETRY_OPTIONS.maximumAttempts,
      maximumMilliseconds:
        options.retry?.maximumMilliseconds || DEFAULT_RETRY_OPTIONS.maximumMilliseconds,
      milliseconds: options.retry?.milliseconds || DEFAULT_RETRY_OPTIONS.milliseconds,
      strategy: options.retry?.strategy || DEFAULT_RETRY_OPTIONS.strategy,
    };
    this.retryCallback = options.retryCallback || defaultRetryCallback;
  }

  public async delete<
    ResponseData = any,
    RequestBody = Record<string, any>,
    RequestParams = Record<string, any>,
    RequestQuery = Record<string, any>,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<ResponseData, RequestBody, RequestParams, RequestQuery>,
  ): Promise<AxiosResponse<ResponseData>> {
    return this.composeRequest<ResponseData, RequestBody, RequestParams, RequestQuery>(
      pathOrUrl,
      "delete",
      options,
    );
  }

  public async get<
    ResponseData = any,
    RequestBody = Record<string, any>,
    RequestParams = Record<string, any>,
    RequestQuery = Record<string, any>,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<ResponseData, RequestBody, RequestParams, RequestQuery>,
  ): Promise<AxiosResponse<ResponseData>> {
    return this.composeRequest<ResponseData, RequestBody, RequestParams, RequestQuery>(
      pathOrUrl,
      "get",
      options,
    );
  }

  public async head<
    ResponseData = any,
    RequestBody = Record<string, any>,
    RequestParams = Record<string, any>,
    RequestQuery = Record<string, any>,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<ResponseData, RequestBody, RequestParams, RequestQuery>,
  ): Promise<AxiosResponse<ResponseData>> {
    return this.composeRequest<ResponseData, RequestBody, RequestParams, RequestQuery>(
      pathOrUrl,
      "head",
      options,
    );
  }

  public async options<
    ResponseData = any,
    RequestBody = Record<string, any>,
    RequestParams = Record<string, any>,
    RequestQuery = Record<string, any>,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<ResponseData, RequestBody, RequestParams, RequestQuery>,
  ): Promise<AxiosResponse<ResponseData>> {
    return this.composeRequest<ResponseData, RequestBody, RequestParams, RequestQuery>(
      pathOrUrl,
      "options",
      options,
    );
  }

  public async patch<
    ResponseData = any,
    RequestBody = Record<string, any>,
    RequestParams = Record<string, any>,
    RequestQuery = Record<string, any>,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<ResponseData, RequestBody, RequestParams, RequestQuery>,
  ): Promise<AxiosResponse<ResponseData>> {
    return this.composeRequest<ResponseData, RequestBody, RequestParams, RequestQuery>(
      pathOrUrl,
      "patch",
      options,
    );
  }

  public async post<
    ResponseData = any,
    RequestBody = Record<string, any>,
    RequestParams = Record<string, any>,
    RequestQuery = Record<string, any>,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<ResponseData, RequestBody, RequestParams, RequestQuery>,
  ): Promise<AxiosResponse<ResponseData>> {
    return this.composeRequest<ResponseData, RequestBody, RequestParams, RequestQuery>(
      pathOrUrl,
      "post",
      options,
    );
  }

  public async put<
    ResponseData = any,
    RequestBody = Record<string, any>,
    RequestParams = Record<string, any>,
    RequestQuery = Record<string, any>,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<ResponseData, RequestBody, RequestParams, RequestQuery>,
  ): Promise<AxiosResponse<ResponseData>> {
    return this.composeRequest<ResponseData, RequestBody, RequestParams, RequestQuery>(
      pathOrUrl,
      "put",
      options,
    );
  }

  public async request<
    ResponseData = any,
    RequestBody = Record<string, any>,
    RequestParams = Record<string, any>,
    RequestQuery = Record<string, any>,
  >(
    options: MethodOptions & RequestOptions<ResponseData, RequestBody, RequestParams, RequestQuery>,
  ): Promise<AxiosResponse<ResponseData>> {
    const { method, path, url, ...rest } = options;
    const pathOrUrl = url || path;

    if (!pathOrUrl) {
      throw new Error(`Invalid request [ path: ${path} | url: ${url} ]`);
    }

    return this.composeRequest<ResponseData, RequestBody, RequestParams, RequestQuery>(
      pathOrUrl,
      method,
      rest,
    );
  }

  private async composeRequest<
    ResponseData = any,
    RequestBody = Record<string, any>,
    RequestParams = Record<string, any>,
    RequestQuery = Record<string, any>,
  >(
    pathOrUrl: URL | string,
    method: Method,
    options: RequestOptions<ResponseData, RequestBody, RequestParams, RequestQuery> = {},
  ): Promise<AxiosResponse<ResponseData>> {
    const {
      auth,
      body = {},
      config = {},
      headers = {},
      middleware = [],
      params = {},
      query = {},
      retry = {},
      retryCallback,
      timeout,
      withCredentials,
    } = options;

    const valid = getValidUrl(pathOrUrl, this.baseURL);
    const searchParams = extractSearchParams<RequestQuery>(valid);
    const url = getPlainUrl(valid).toString();

    const app: AppContext = {
      alias: this.alias,
      config: this.config,
      headers: this.headers,
      retry: this.retry,
      retryCallback: this.retryCallback,
    };

    const req: RequestContext<RequestBody, RequestParams, RequestQuery> = {
      body: body as RequestBody,
      config: {
        ...this.config,
        ...config,
        auth,
        method,
        timeout,
        withCredentials,
      },
      correlationId: uuid(),
      headers: { ...this.headers, ...headers },
      params: params as RequestParams,
      query: { ...searchParams, ...query },
      requestId: uuid(),
      retry: { ...retry, ...this.retry },
      retryCallback: retryCallback || this.retryCallback,
      url,
    };

    const context: Context<ResponseData, RequestBody, RequestParams, RequestQuery> = {
      app,
      req,
      res: DEFAULT_AXIOS_RESPONSE,
    };

    const result = await resolveMiddleware<
      Context<ResponseData, RequestBody, RequestParams, RequestQuery>
    >(context, [
      ...(this.logger ? [axiosDefaultResponseLogger(this.logger)] : []),
      axiosDefaultHeadersMiddleware,
      ...this.middleware,
      ...middleware,
      ...(this.logger ? [axiosDefaultRequestLogger(this.logger)] : []),
      axiosRequestHandler,
    ]);

    return result.res;
  }
}

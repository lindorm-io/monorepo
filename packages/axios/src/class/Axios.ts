import { AxiosOptions, Context, MethodOptions, Middleware, RequestOptions } from "../types";
import { AxiosResponse, AxiosBasicCredentials, Method } from "axios";
import { RetryOptions } from "@lindorm-io/retry";
import { TransformMode } from "@lindorm-io/case";
import { axiosRequestHandler, defaultRetryCallback } from "../util";
import { destructUrl, Protocol } from "@lindorm-io/url";
import { resolveMiddleware } from "@lindorm-io/middleware";
import {
  DEFAULT_AXIOS_RESPONSE,
  DEFAULT_RETRY_OPTIONS,
  DEFAULT_TIMEOUT_OPTIONS,
} from "../constant";

export class Axios {
  private readonly auth: AxiosBasicCredentials | undefined;
  private readonly headers: Record<string, string | number>;
  private readonly host: string | undefined;
  private readonly middleware: Middleware[];
  private readonly name: string | undefined;
  private readonly port: number | undefined;
  private readonly protocol: Protocol | undefined;
  private readonly queryCaseTransform: TransformMode;
  private readonly retry: RetryOptions;
  private readonly timeout: number;
  private readonly withCredentials: boolean;

  constructor(options: AxiosOptions = {}) {
    const { host, port, protocol } = destructUrl(options.host);

    this.auth = options.auth;
    this.host = host;
    this.middleware = options.middleware || [];
    this.headers = options.headers || {};
    this.name = options.name;
    this.port = options.port || port;
    this.queryCaseTransform = options.queryCaseTransform || "snake";
    this.protocol = options.protocol || protocol || "https";
    this.retry = {
      maximumAttempts: options.retry?.maximumAttempts || DEFAULT_RETRY_OPTIONS.maximumAttempts,
      maximumMilliseconds:
        options.retry?.maximumMilliseconds || DEFAULT_RETRY_OPTIONS.maximumMilliseconds,
      milliseconds: options.retry?.milliseconds || DEFAULT_RETRY_OPTIONS.milliseconds,
      strategy: options.retry?.strategy || DEFAULT_RETRY_OPTIONS.strategy,
    };
    this.timeout = options.timeout || DEFAULT_TIMEOUT_OPTIONS;
    this.withCredentials = options.withCredentials === true;
  }

  public async delete<
    ResponseData = any,
    RequestBody = Record<string, any>,
    RequestHeaders = Record<string, string | number>,
    RequestParams = Record<string, any>,
    RequestQuery = Record<string, any>,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<RequestBody, RequestHeaders, RequestParams, RequestQuery>,
  ): Promise<AxiosResponse<ResponseData>> {
    return this.composeRequest<
      ResponseData,
      RequestBody,
      RequestHeaders,
      RequestParams,
      RequestQuery
    >(pathOrUrl, "delete", options);
  }

  public async get<
    ResponseData = any,
    RequestBody = Record<string, any>,
    RequestHeaders = Record<string, string | number>,
    RequestParams = Record<string, any>,
    RequestQuery = Record<string, any>,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<RequestBody, RequestHeaders, RequestParams, RequestQuery>,
  ): Promise<AxiosResponse<ResponseData>> {
    return this.composeRequest<
      ResponseData,
      RequestBody,
      RequestHeaders,
      RequestParams,
      RequestQuery
    >(pathOrUrl, "get", options);
  }

  public async head<
    ResponseData = any,
    RequestBody = Record<string, any>,
    RequestHeaders = Record<string, string | number>,
    RequestParams = Record<string, any>,
    RequestQuery = Record<string, any>,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<RequestBody, RequestHeaders, RequestParams, RequestQuery>,
  ): Promise<AxiosResponse<ResponseData>> {
    return this.composeRequest<
      ResponseData,
      RequestBody,
      RequestHeaders,
      RequestParams,
      RequestQuery
    >(pathOrUrl, "head", options);
  }

  public async options<
    ResponseData = any,
    RequestBody = Record<string, any>,
    RequestHeaders = Record<string, string | number>,
    RequestParams = Record<string, any>,
    RequestQuery = Record<string, any>,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<RequestBody, RequestHeaders, RequestParams, RequestQuery>,
  ): Promise<AxiosResponse<ResponseData>> {
    return this.composeRequest<
      ResponseData,
      RequestBody,
      RequestHeaders,
      RequestParams,
      RequestQuery
    >(pathOrUrl, "options", options);
  }

  public async patch<
    ResponseData = any,
    RequestBody = Record<string, any>,
    RequestHeaders = Record<string, string | number>,
    RequestParams = Record<string, any>,
    RequestQuery = Record<string, any>,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<RequestBody, RequestHeaders, RequestParams, RequestQuery>,
  ): Promise<AxiosResponse<ResponseData>> {
    return this.composeRequest<
      ResponseData,
      RequestBody,
      RequestHeaders,
      RequestParams,
      RequestQuery
    >(pathOrUrl, "patch", options);
  }

  public async post<
    ResponseData = any,
    RequestBody = Record<string, any>,
    RequestHeaders = Record<string, string | number>,
    RequestParams = Record<string, any>,
    RequestQuery = Record<string, any>,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<RequestBody, RequestHeaders, RequestParams, RequestQuery>,
  ): Promise<AxiosResponse<ResponseData>> {
    return this.composeRequest<
      ResponseData,
      RequestBody,
      RequestHeaders,
      RequestParams,
      RequestQuery
    >(pathOrUrl, "post", options);
  }

  public async put<
    ResponseData = any,
    RequestBody = Record<string, any>,
    RequestHeaders = Record<string, string | number>,
    RequestParams = Record<string, any>,
    RequestQuery = Record<string, any>,
  >(
    pathOrUrl: URL | string,
    options?: RequestOptions<RequestBody, RequestHeaders, RequestParams, RequestQuery>,
  ): Promise<AxiosResponse<ResponseData>> {
    return this.composeRequest<
      ResponseData,
      RequestBody,
      RequestHeaders,
      RequestParams,
      RequestQuery
    >(pathOrUrl, "put", options);
  }

  public async request<
    ResponseData = any,
    RequestBody = Record<string, any>,
    RequestHeaders = Record<string, string | number>,
    RequestParams = Record<string, any>,
    RequestQuery = Record<string, any>,
  >(
    options: MethodOptions &
      RequestOptions<RequestBody, RequestHeaders, RequestParams, RequestQuery>,
  ): Promise<AxiosResponse<ResponseData>> {
    const { method, path, url, ...rest } = options;

    const pathOrUrl = url || path;
    if (!pathOrUrl) {
      throw new Error(`Invalid request [ path: ${path} | url: ${url} ]`);
    }

    return this.composeRequest<
      ResponseData,
      RequestBody,
      RequestHeaders,
      RequestParams,
      RequestQuery
    >(url! || path!, method, rest);
  }

  private async composeRequest<
    ResponseData = any,
    RequestBody = Record<string, any>,
    RequestHeaders = Record<string, string | number>,
    RequestParams = Record<string, any>,
    RequestQuery = Record<string, any>,
  >(
    pathOrUrl: URL | string,
    method: Method,
    options: RequestOptions<RequestBody, RequestHeaders, RequestParams, RequestQuery> = {},
  ): Promise<AxiosResponse<ResponseData>> {
    const {
      auth,
      body,
      config,
      headers = {},
      middleware = [],
      params = {},
      query = {},
      queryCaseTransform,
      retry = {},
      retryCallback,
      timeout,
      withCredentials,
    } = options;

    const url = destructUrl(pathOrUrl);

    const host = url.host || this.host;
    if (!host) {
      throw new Error(`Invalid request [ host: ${typeof host} ]`);
    }

    const context = {
      axios: {
        auth: this.auth,
        headers: this.headers,
        host: this.host || null,
        name: this.name || null,
        port: this.port || null,
        protocol: this.protocol || null,
        retry: this.retry,
        timeout: this.timeout,
        withCredentials: this.withCredentials,
      },
      req: {
        auth: auth || this.auth,
        body: body || {},
        config: config || {},
        headers: { ...headers, ...this.headers },
        host,
        method,
        params: params || {},
        path: url.pathname || "/",
        port: url.port || this.port,
        protocol: url.protocol || this.protocol,
        query: { ...url.query, ...query },
        queryCaseTransform: queryCaseTransform || this.queryCaseTransform,
        retry: { ...this.retry, ...retry },
        retryCallback: retryCallback || defaultRetryCallback,
        timeout: timeout || this.timeout,
        withCredentials: withCredentials || this.withCredentials,
      },
      res: DEFAULT_AXIOS_RESPONSE,
    } satisfies Context;

    const result = await resolveMiddleware<Context<ResponseData>>(context, [
      ...this.middleware,
      ...middleware,
      axiosRequestHandler,
    ]);

    return result.res;
  }
}

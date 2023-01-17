import { AxiosOptions, Context, MethodOptions, Middleware, RequestOptions } from "../types";
import { AxiosResponse, AxiosBasicCredentials, Method } from "axios";
import { RetryOptions } from "@lindorm-io/retry";
import { axiosRequestHandler, defaultRetryCallback } from "../util";
import { destructUrl, Protocol } from "@lindorm-io/url";
import { resolveMiddleware } from "@lindorm-io/middleware";
import {
  DEFAULT_AUTH_OPTIONS,
  DEFAULT_AXIOS_RESPONSE,
  DEFAULT_RETRY_OPTIONS,
  DEFAULT_TIMEOUT_OPTIONS,
} from "../constant";

export class Axios {
  private readonly auth: AxiosBasicCredentials;
  private readonly host: string | undefined;
  private readonly middleware: Middleware[];
  private readonly name: string | undefined;
  private readonly port: number | undefined;
  private readonly protocol: Protocol | undefined;
  private readonly retry: RetryOptions;
  private readonly timeout: number;
  private readonly withCredentials: boolean;

  constructor(options: AxiosOptions = {}) {
    const { host, port, protocol } = destructUrl(options.host);

    this.auth = options.auth || DEFAULT_AUTH_OPTIONS;
    this.host = host;
    this.middleware = options.middleware || [];
    this.name = options.name;
    this.port = options.port || port;
    this.protocol = options.protocol || protocol || "https";
    this.retry = options.retry || DEFAULT_RETRY_OPTIONS;
    this.timeout = options.timeout || DEFAULT_TIMEOUT_OPTIONS;
    this.withCredentials = options.withCredentials === true;
  }

  public async delete<Data = any>(
    pathOrUrl: URL | string,
    options?: RequestOptions,
  ): Promise<AxiosResponse<Data>> {
    return this.composeRequest<Data>(pathOrUrl, "delete", options);
  }

  public async get<Data = any>(
    pathOrUrl: URL | string,
    options?: RequestOptions,
  ): Promise<AxiosResponse<Data>> {
    return this.composeRequest<Data>(pathOrUrl, "get", options);
  }

  public async head<Data = any>(
    pathOrUrl: URL | string,
    options?: RequestOptions,
  ): Promise<AxiosResponse<Data>> {
    return this.composeRequest<Data>(pathOrUrl, "head", options);
  }

  public async options<Data = any>(
    pathOrUrl: URL | string,
    options?: RequestOptions,
  ): Promise<AxiosResponse<Data>> {
    return this.composeRequest<Data>(pathOrUrl, "options", options);
  }

  public async patch<Data = any>(
    pathOrUrl: URL | string,
    options?: RequestOptions,
  ): Promise<AxiosResponse<Data>> {
    return this.composeRequest<Data>(pathOrUrl, "patch", options);
  }

  public async post<Data = any>(
    pathOrUrl: URL | string,
    options?: RequestOptions,
  ): Promise<AxiosResponse<Data>> {
    return this.composeRequest<Data>(pathOrUrl, "post", options);
  }

  public async put<Data = any>(
    pathOrUrl: URL | string,
    options?: RequestOptions,
  ): Promise<AxiosResponse<Data>> {
    return this.composeRequest<Data>(pathOrUrl, "put", options);
  }

  public async request<Data = any>(
    options: MethodOptions & RequestOptions,
  ): Promise<AxiosResponse<Data>> {
    const { method, path, url, ...rest } = options;

    return this.composeRequest<Data>(url || path, method, rest);
  }

  private async composeRequest<Data = any>(
    pathOrUrl: URL | string,
    method: Method,
    options: RequestOptions = {},
  ): Promise<AxiosResponse<Data>> {
    const {
      auth,
      body,
      config,
      headers = {},
      params = {},
      query = {},
      retry,
      retryCallback,
      timeout,
      withCredentials,
      middleware = [],
    } = options;

    const url = destructUrl(pathOrUrl);

    const context = {
      axios: {
        auth: this.auth,
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
        body: body,
        config: config,
        headers: headers || {},
        host: url.host || this.host,
        method,
        params,
        path: url.pathname,
        port: url.port || this.port,
        protocol: url.protocol || this.protocol,
        query: { ...url.query, ...query },
        retry: retry || this.retry,
        retryCallback: retryCallback || defaultRetryCallback,
        timeout: timeout || this.timeout,
        withCredentials: withCredentials || this.withCredentials,
      },
      res: DEFAULT_AXIOS_RESPONSE,
    };

    const result = await resolveMiddleware<Context<Data>>(context, [
      ...this.middleware,
      ...middleware,
      axiosRequestHandler,
    ]);

    return result.res;
  }
}

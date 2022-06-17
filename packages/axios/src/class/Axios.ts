import axios, { AxiosResponse as Response, Method } from "axios";
import { IAxiosRequestError } from "../error";
import { ILogger } from "@lindorm-io/winston";
import { axiosCaseSwitchMiddleware, axiosRetryMiddleware } from "../middleware/default";
import { convertError, convertResponse, logAxiosError, logAxiosResponse } from "../util";
import { createURL, sleep } from "@lindorm-io/core";
import { getResponseTime } from "../util/get-response-time";
import { startsWith } from "lodash";
import {
  AxiosMiddleware,
  AxiosOptions,
  AxiosRequest,
  AxiosResponse,
  RequestConfig,
  RequestOptions,
} from "../types";

export class Axios {
  private readonly host: string | undefined;
  private readonly port: number | undefined;
  private readonly logger: ILogger;
  private readonly middleware: Array<AxiosMiddleware>;
  private readonly name: string | undefined;

  public constructor(options: AxiosOptions) {
    this.port = options.port;
    this.host = options.host;
    this.logger = options.logger.createChildLogger(["Axios", options.name]);
    this.middleware = options.middleware || [];
    this.name = options.name;
  }

  public async get<Data = Record<string, any>>(
    path: string,
    options: RequestOptions = {},
  ): Promise<AxiosResponse<Data>> {
    if (options.body) {
      throw new Error("Unable to used data for a GET request");
    }

    return this.createRequest<Data>({ method: "get", path }, options);
  }

  public async post<Data = Record<string, any>>(
    path: string,
    options: RequestOptions = {},
  ): Promise<AxiosResponse<Data>> {
    return this.createRequest<Data>({ method: "post", path }, options);
  }

  public async put<Data = Record<string, any>>(
    path: string,
    options: RequestOptions = {},
  ): Promise<AxiosResponse<Data>> {
    return this.createRequest<Data>({ method: "put", path }, options);
  }

  public async patch<Data = Record<string, any>>(
    path: string,
    options: RequestOptions = {},
  ): Promise<AxiosResponse<Data>> {
    return this.createRequest<Data>({ method: "patch", path }, options);
  }

  public async delete<Data = Record<string, any>>(
    path: string,
    options: RequestOptions = {},
  ): Promise<AxiosResponse<Data>> {
    return this.createRequest<Data>({ method: "delete", path }, options);
  }

  public async request<Data = Record<string, any>>(
    method: Method,
    path: string,
    options: RequestOptions = {},
  ): Promise<AxiosResponse<Data>> {
    return this.createRequest<Data>({ method, path }, options);
  }

  private createURL(path: string, options: RequestOptions): string {
    const { params, query } = options;

    if (startsWith(path, "http")) {
      return createURL(path, { params, query }).toString();
    }

    if (this.host) {
      return createURL(path, {
        host: this.host,
        port: this.port,
        params,
        query,
      }).toString();
    }

    throw new Error(`Invalid Path: [ ${path} ]`);
  }

  private async configMiddleware(
    config: RequestConfig,
    options: RequestOptions,
  ): Promise<RequestConfig> {
    const middleware = [...this.middleware, ...(options.middleware || [])];

    for (const mw of middleware) {
      if (!mw.config) continue;
      config = await mw.config(config);
    }

    return config;
  }

  private async errorMiddleware(
    error: IAxiosRequestError,
    options: RequestOptions,
  ): Promise<IAxiosRequestError> {
    const middleware = [...this.middleware, ...(options.middleware || [])];

    for (const mw of middleware) {
      if (!mw.error) continue;
      error = await mw.error(error);
    }

    return error;
  }

  private async requestMiddleware(
    request: AxiosRequest,
    options: RequestOptions,
  ): Promise<AxiosRequest> {
    const middleware = [
      ...this.middleware,
      ...(options.middleware || []),
      axiosCaseSwitchMiddleware,
    ];

    for (const mw of middleware) {
      if (!mw.request) continue;
      request = await mw.request(request);
    }

    return request;
  }

  private async responseMiddleware<Data>(
    response: AxiosResponse<Data>,
    options: RequestOptions,
  ): Promise<AxiosResponse<Data>> {
    const middleware = [
      axiosCaseSwitchMiddleware,
      ...this.middleware,
      ...(options.middleware || []),
    ];

    for (const mw of middleware) {
      if (!mw.response) continue;
      response = (await mw.response(response)) as AxiosResponse<Data>;
    }

    return response;
  }

  private async retryMiddleware(
    error: IAxiosRequestError,
    options: RequestOptions,
  ): Promise<boolean> {
    const middleware = [axiosRetryMiddleware, ...this.middleware, ...(options.middleware || [])];

    let result = false;

    for (const mw of middleware) {
      if (!mw.retry) continue;
      result = await mw.retry(error, options);
    }

    return result;
  }

  private async createRequest<Data>(
    config: RequestConfig,
    options: RequestOptions,
  ): Promise<AxiosResponse<Data>> {
    const start = Date.now();

    options.attempt = options.attempt || 1;
    options.retry = options.retry || 0;

    const { auth, method, path } = await this.configMiddleware(config, options);

    const { body, headers, params, query } = await this.requestMiddleware(
      {
        body: options.body,
        headers: options.headers || {},
        params: options.params,
        query: options.query,
      },
      options,
    );

    const timeout = options.timeout || 3000;
    const url = this.createURL(path, { params, query });

    let response: Response;

    try {
      response = await axios.request({
        method,
        headers,
        timeout,
        url,
        ...(auth ? { auth } : {}),
        ...(body ? { data: body } : {}),
      });

      logAxiosResponse({
        logger: this.logger,
        name: this.name,
        time: getResponseTime(response?.headers, start),
        response,
      });
    } catch (err: any) {
      logAxiosError({
        logger: this.logger,
        name: this.name,
        time: getResponseTime(err?.response?.headers, start),
        error: err,
      });

      if (await this.retryMiddleware(err, options)) {
        await sleep(options.attempt * 100);
        return this.createRequest(config, { ...options, attempt: options.attempt + 1 });
      }

      throw await this.errorMiddleware(convertError(err), options);
    }

    return await this.responseMiddleware<Data>(convertResponse<Data>(response), options);
  }
}

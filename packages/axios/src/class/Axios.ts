import axios, { AxiosResponse as Response, Method } from "axios";
import { IAxiosRequestError } from "../error";
import { Logger } from "@lindorm-io/winston";
import { axiosCaseSwitchMiddleware, axiosRetryMiddleware } from "../middleware/default";
import { convertError, convertResponse, logAxiosError, logAxiosResponse } from "../util";
import { createURL } from "@lindorm-io/core";
import { getResponseTime } from "../util/get-response-time";
import { startsWith } from "lodash";
import {
  AxiosMiddleware,
  AxiosOptions,
  AxiosRequest,
  AxiosResponse,
  RequestConfig,
  RequestOptions,
  Unknown,
} from "../types";

export class Axios {
  private readonly baseUrl: string | null;
  private readonly logger: Logger;
  private readonly middleware: Array<AxiosMiddleware>;
  private readonly name: string | null;

  public constructor(options: AxiosOptions) {
    this.baseUrl = options.baseUrl || null;
    this.logger = options.logger.createChildLogger("Axios");
    this.middleware = options.middleware || [];
    this.name = options.name || null;
  }

  public async get<Data = Unknown>(
    path: string,
    options: RequestOptions = {},
  ): Promise<AxiosResponse<Data>> {
    if (options.data) {
      throw new Error("Unable to used data for a GET request");
    }

    return this.createRequest<Data>({ method: "get", path }, options);
  }

  public async post<Data = Unknown>(
    path: string,
    options: RequestOptions = {},
  ): Promise<AxiosResponse<Data>> {
    return this.createRequest<Data>({ method: "post", path }, options);
  }

  public async put<Data = Unknown>(
    path: string,
    options: RequestOptions = {},
  ): Promise<AxiosResponse<Data>> {
    return this.createRequest<Data>({ method: "put", path }, options);
  }

  public async patch<Data = Unknown>(
    path: string,
    options: RequestOptions = {},
  ): Promise<AxiosResponse<Data>> {
    return this.createRequest<Data>({ method: "patch", path }, options);
  }

  public async delete<Data = Unknown>(
    path: string,
    options: RequestOptions = {},
  ): Promise<AxiosResponse<Data>> {
    return this.createRequest<Data>({ method: "delete", path }, options);
  }

  public async request<Data = Unknown>(
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

    if (this.baseUrl) {
      return createURL(path, { baseUrl: this.baseUrl, params, query }).toString();
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

    options.retry = options.retry || 0;

    const { auth, method, path } = await this.configMiddleware(config, options);

    const { data, headers, params, query } = await this.requestMiddleware(
      {
        data: options.data,
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
        ...(data ? { data } : {}),
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
        return this.createRequest(config, { ...options, retry: options.retry - 1 });
      }

      throw await this.errorMiddleware(convertError(err), options);
    }

    return await this.responseMiddleware<Data>(convertResponse<Data>(response), options);
  }
}

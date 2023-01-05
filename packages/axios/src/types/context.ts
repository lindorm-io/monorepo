import { AxiosBasicCredentials, AxiosRequestConfig, AxiosResponse, Method } from "axios";
import { ILogger } from "@lindorm-io/winston";
import { Protocol } from "./request";
import { RetryCallback, RetryOptions } from "./retry";

export type ContextRequest<
  Body = Record<string, any>,
  Headers = Record<string, string | number>,
  Params = Record<string, any>,
  Query = Record<string, any>,
> = {
  auth: AxiosBasicCredentials;
  body: Body;
  config: AxiosRequestConfig;
  headers: Headers;
  host: string;
  method: Method;
  params: Params;
  path: string;
  port: number;
  protocol: Protocol;
  query: Query;
  retry: RetryOptions;
  retryCallback: RetryCallback;
  timeout: number;
  withCredentials: boolean;
};

export type Context<
  Body = Record<string, any>,
  Headers = Record<string, string | number>,
  Params = Record<string, any>,
  Query = Record<string, any>,
  ResponseData = any,
> = {
  req: ContextRequest<Body, Headers, Params, Query>;
  res: AxiosResponse<ResponseData, Body>;
  logger: ILogger;
};

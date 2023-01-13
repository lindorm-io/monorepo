import { AxiosBasicCredentials, AxiosRequestConfig, AxiosResponse, Method } from "axios";
import { Protocol } from "@lindorm-io/url";
import { RetryCallback } from "./retry";
import { RetryOptions } from "@lindorm-io/retry";

export type AxiosContext = {
  auth: AxiosBasicCredentials;
  host: string | null;
  name: string | null;
  port: number | null;
  protocol: Protocol | null;
  retry: RetryOptions;
  timeout: number;
  withCredentials: boolean;
};

export type RequestContext<
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
  axios: AxiosContext;
  req: RequestContext<Body, Headers, Params, Query>;
  res: AxiosResponse<ResponseData, Body>;
};

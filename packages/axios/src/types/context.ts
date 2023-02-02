import { AxiosBasicCredentials, RawAxiosRequestConfig, AxiosResponse, Method } from "axios";
import { Protocol } from "@lindorm-io/url";
import { RetryCallback } from "./retry";
import { RetryOptions } from "@lindorm-io/retry";
import { TransformMode } from "@lindorm-io/case";

export type AxiosContext = {
  auth: AxiosBasicCredentials;
  headers: Record<string, string | number>;
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
  config: RawAxiosRequestConfig;
  headers: Headers;
  host: string;
  method: Method;
  params: Params;
  path: string;
  port: number;
  protocol: Protocol;
  query: Query;
  queryCaseTransform: TransformMode;
  retry: RetryOptions;
  retryCallback: RetryCallback;
  timeout: number;
  withCredentials: boolean;
};

export type Context<
  ResponseData = any,
  RequestBody = Record<string, any>,
  RequestHeaders = Record<string, string | number>,
  RequestParams = Record<string, any>,
  RequestQuery = Record<string, any>,
> = {
  axios: AxiosContext;
  req: RequestContext<RequestBody, RequestHeaders, RequestParams, RequestQuery>;
  res: AxiosResponse<ResponseData, Body>;
};

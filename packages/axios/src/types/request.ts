import { AxiosBasicCredentials, RawAxiosRequestConfig, Method } from "axios";
import { Middleware } from "./middleware";
import { Protocol } from "@lindorm-io/url";
import { RetryCallback } from "./retry";
import { RetryOptions } from "@lindorm-io/retry";
import { TransformMode } from "@lindorm-io/case";

export type AxiosOptions = {
  auth?: AxiosBasicCredentials;
  headers?: Record<string, string | number>;
  host?: string;
  middleware?: Middleware[];
  name?: string;
  port?: number;
  protocol?: Protocol;
  queryCaseTransform?: TransformMode;
  retry?: Partial<RetryOptions>;
  timeout?: number;
  withCredentials?: boolean;
};

export type MethodOptions = {
  method: Method;
  path?: string;
  url?: URL | string;
};

export type RequestOptions<
  Body = Record<string, any>,
  Headers = Record<string, string | number>,
  Params = Record<string, any>,
  Query = Record<string, any>,
> = {
  auth?: AxiosBasicCredentials;
  body?: Body;
  config?: RawAxiosRequestConfig;
  headers?: Headers;
  host?: string;
  middleware?: Middleware[];
  params?: Params;
  port?: number;
  protocol?: Protocol;
  query?: Query;
  queryCaseTransform?: TransformMode;
  retry?: Partial<RetryOptions>;
  retryCallback?: RetryCallback;
  timeout?: number;
  withCredentials?: boolean;
};

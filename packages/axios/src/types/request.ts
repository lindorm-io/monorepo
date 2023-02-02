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

export type RequestOptions = {
  auth?: AxiosBasicCredentials;
  body?: Record<string, any>;
  config?: RawAxiosRequestConfig;
  headers?: Record<string, string | number>;
  host?: string;
  middleware?: Middleware[];
  params?: Record<string, any>;
  port?: number;
  protocol?: Protocol;
  query?: Record<string, any>;
  queryCaseTransform?: TransformMode;
  retry?: Partial<RetryOptions>;
  retryCallback?: RetryCallback;
  timeout?: number;
  withCredentials?: boolean;
};

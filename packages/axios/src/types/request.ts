import { AxiosBasicCredentials, AxiosRequestConfig, Method } from "axios";
import { Middleware } from "./middleware";
import { RetryCallback, RetryOptions } from "./retry";

export type Protocol = "http" | "https";

export type AxiosOptions = {
  auth?: AxiosBasicCredentials;
  host?: string;
  middleware?: Middleware[];
  name?: string;
  port?: number;
  protocol?: Protocol;
  retry?: RetryOptions;
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
  config?: AxiosRequestConfig;
  headers?: Record<string, string | number>;
  host?: string;
  middleware?: Middleware[];
  params?: Record<string, any>;
  port?: number;
  protocol?: Protocol;
  query?: Record<string, any>;
  retry?: RetryOptions;
  retryCallback?: RetryCallback;
  timeout?: number;
  withCredentials?: boolean;
};

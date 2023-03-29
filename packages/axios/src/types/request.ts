import { AxiosBasicCredentials, Method } from "axios";
import { Middleware } from "./middleware";
import { RawAxiosRequestConfigOptions } from "./overrides";
import { RetryCallback } from "./retry";
import { RetryOptions } from "@lindorm-io/retry";
import { TransformMode } from "@lindorm-io/case";

export type AxiosClientProperties = {
  id: string | null;
  environment: string | null;
  name: string | null;
  platform: string | null;
  version: string | null;
};

export type AxiosOptions = {
  alias?: string;
  middleware?: Middleware[];

  // is used to calculate baseURL
  baseURL?: URL | string;
  host?: string;
  port?: number;

  // will be placed in context
  client?: Partial<AxiosClientProperties>;
  config?: RawAxiosRequestConfigOptions;
  queryCaseTransform?: TransformMode;
  retry?: Partial<RetryOptions>;
  retryCallback?: RetryCallback;

  // will be placed in config in context
  auth?: AxiosBasicCredentials;
  headers?: Record<string, any>;
  timeout?: number;
  withCredentials?: boolean;
};

export type MethodOptions = {
  method: Method;
  path?: string;
  url?: URL | string;
};

export type RequestOptions<
  ResponseData = any,
  Body = Record<string, any>,
  Params = Record<string, any>,
  Query = Record<string, any>,
> = {
  auth?: AxiosBasicCredentials;
  body?: Body;
  config?: RawAxiosRequestConfigOptions;
  headers?: Record<string, any>;
  middleware?: Array<Middleware<ResponseData, Body, Params, Query>>;
  params?: Params;
  query?: Query;
  queryCaseTransform?: TransformMode;
  retry?: Partial<RetryOptions>;
  retryCallback?: RetryCallback;
  timeout?: number;
  withCredentials?: boolean;
};

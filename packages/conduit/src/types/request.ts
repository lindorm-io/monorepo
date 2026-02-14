import { RetryOptions } from "@lindorm/retry";
import { Dict, HttpMethod, Param, Query } from "@lindorm/types";
import { Readable } from "stream";
import { ConduitUsing, ExpectedResponse } from "../types";
import { ConduitMiddleware } from "./conduit";
import { ConfigOptions } from "./overrides";
import { OnRetryCallback, RetryCallback } from "./retry";

export type MethodOptions = {
  method: HttpMethod;
  path?: string;
  url?: URL | string;
};

export type RequestOptions<
  ResponseData = any,
  RequestBody = Dict,
  RequestParams = Dict<Param>,
  RequestQuery = Dict<Query>,
> = {
  body?: RequestBody;
  config?: ConfigOptions;
  expectedResponse?: ExpectedResponse;
  filename?: string;
  form?: FormData;
  headers?: Dict<string>;
  middleware?: Array<
    ConduitMiddleware<ResponseData, RequestBody, RequestParams, RequestQuery>
  >;
  onDownloadProgress?: (event: { loaded: number; total?: number }) => void;
  onRetry?: OnRetryCallback;
  onUploadProgress?: (event: { loaded: number; total?: number }) => void;
  params?: RequestParams;
  query?: RequestQuery;
  retryCallback?: RetryCallback;
  retryOptions?: RetryOptions;
  signal?: AbortSignal;
  stream?: Readable;
  timeout?: number;
  using?: ConduitUsing;
  withCredentials?: boolean;
};

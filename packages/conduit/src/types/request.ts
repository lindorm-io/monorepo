import type { RetryOptions } from "@lindorm/retry";
import type { Dict, HttpMethod, Param, Query } from "@lindorm/types";
import type { Readable } from "stream";
import type { ConduitAdapter, ExpectedResponse } from "../types/index.js";
import type { ConduitMiddleware } from "./conduit.js";
import type { ConduitLookup } from "./lookup.js";
import type { ConduitAxiosOverrides } from "./overrides.js";
import type { OnRetryCallback, RetryCallback } from "./retry.js";

export type ConduitMethodOptions = {
  method: HttpMethod;
  path?: string;
  url?: URL | string;
};

/**
 * The encodings conduit can serialise a request `body` into.
 */
export type ConduitContentType = "application/json" | "application/x-www-form-urlencoded";

export type ConduitRequestOptions<
  ResponseData = any,
  RequestBody = Dict,
  RequestParams = Dict<Param>,
  RequestQuery = Dict<Query>,
> = {
  adapter?: ConduitAdapter;
  body?: RequestBody;
  config?: ConduitAxiosOverrides;
  /**
   * How to serialise `body`. Defaults to `application/json`.
   *
   * Evaluated at compose time — AFTER every middleware has run — so a
   * key-rewriting middleware such as `conduitChangeRequestBodyMiddleware`
   * still applies to a form-encoded request. `form` takes precedence: when
   * both are given the `body` is not sent.
   */
  contentType?: ConduitContentType;
  expectedResponse?: ExpectedResponse;
  filename?: string;
  form?: FormData;
  headers?: Dict<string>;
  /** Per-request DNS resolver hook; overrides the Conduit-level `lookup`. */
  lookup?: ConduitLookup;
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
  withCredentials?: boolean;
};

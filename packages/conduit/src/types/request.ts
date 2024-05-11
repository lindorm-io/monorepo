import { HttpMethod } from "@lindorm/enums";
import { RetryOptions } from "@lindorm/retry";
import { Dict, Header, Param, Query } from "@lindorm/types";
import { Readable } from "stream";
import { ConduitUsing } from "../enums";
import { ConduitMiddleware } from "./conduit";
import { ConfigOptions } from "./overrides";
import { RetryCallback } from "./retry";

export type MethodOptions = {
  method: HttpMethod;
  path?: string;
  url?: URL | string;
};

export type RequestOptions<D = any, B = Dict, P = Dict<Param>, Q = Dict<Query>> = {
  body?: B;
  config?: ConfigOptions;
  filename?: string;
  form?: FormData;
  headers?: Dict<Header>;
  middleware?: Array<ConduitMiddleware<D, B, P, Q>>;
  params?: P;
  query?: Q;
  retryCallback?: RetryCallback;
  retryOptions?: RetryOptions;
  stream?: Readable;
  timeout?: number;
  using?: ConduitUsing;
  withCredentials?: boolean;
};

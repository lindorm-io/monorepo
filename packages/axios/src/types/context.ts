import { RetryOptions } from "@lindorm-io/retry";
import { AxiosResponse } from "axios";
import { RawAxiosRequestConfigContext } from "./overrides";
import { RetryCallback } from "./retry";

export type AppContext = {
  alias: string | null;
  config: RawAxiosRequestConfigContext;
  headers: Record<string, any>;
  retry: RetryOptions;
  retryCallback: RetryCallback;
};

export type RequestContext<
  Body = Record<string, any>,
  Params = Record<string, any>,
  Query = Record<string, any>,
> = {
  body: Body;
  config: RawAxiosRequestConfigContext;
  correlationId: string;
  headers: Record<string, any>;
  params: Params;
  query: Query;
  requestId: string;
  retry: RetryOptions;
  retryCallback: RetryCallback;
  url: string;
};

export type Context<
  ResponseData = any,
  RequestBody = Record<string, any>,
  RequestParams = Record<string, any>,
  RequestQuery = Record<string, any>,
> = {
  app: AppContext;
  req: RequestContext<RequestBody, RequestParams, RequestQuery>;
  res: AxiosResponse<ResponseData, Body>;
};

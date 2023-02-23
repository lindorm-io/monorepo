import { AxiosResponse } from "axios";
import { RawAxiosRequestConfigContext } from "./overrides";
import { RetryCallback } from "./retry";
import { RetryOptions } from "@lindorm-io/retry";
import { TransformMode } from "@lindorm-io/case";

export type AppContext = {
  clientName: string;
  config: RawAxiosRequestConfigContext;
  headers: Record<string, any>;
  queryCaseTransform: TransformMode;
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
  headers: Record<string, any>;
  params: Params;
  query: Query;
  queryCaseTransform: TransformMode;
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

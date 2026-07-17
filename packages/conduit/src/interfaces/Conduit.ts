import type { Dict } from "@lindorm/types";
import type {
  ConduitResponse,
  ConduitMethodOptions,
  ConduitRequestOptions,
} from "../types/index.js";

export interface IConduit {
  delete<
    ResponseData = any,
    RequestBody = Dict,
    RequestParams = Dict,
    RequestQuery = Dict,
  >(
    pathOrUrl: URL | string,
    options?: ConduitRequestOptions<
      ResponseData,
      RequestBody,
      RequestParams,
      RequestQuery
    >,
  ): Promise<ConduitResponse<ResponseData>>;

  get<ResponseData = any, RequestBody = Dict, RequestParams = Dict, RequestQuery = Dict>(
    pathOrUrl: URL | string,
    options?: ConduitRequestOptions<
      ResponseData,
      RequestBody,
      RequestParams,
      RequestQuery
    >,
  ): Promise<ConduitResponse<ResponseData>>;

  head<ResponseData = any, RequestBody = Dict, RequestParams = Dict, RequestQuery = Dict>(
    pathOrUrl: URL | string,
    options?: ConduitRequestOptions<
      ResponseData,
      RequestBody,
      RequestParams,
      RequestQuery
    >,
  ): Promise<ConduitResponse<ResponseData>>;

  options<
    ResponseData = any,
    RequestBody = Dict,
    RequestParams = Dict,
    RequestQuery = Dict,
  >(
    pathOrUrl: URL | string,
    options?: ConduitRequestOptions<
      ResponseData,
      RequestBody,
      RequestParams,
      RequestQuery
    >,
  ): Promise<ConduitResponse<ResponseData>>;

  patch<
    ResponseData = any,
    RequestBody = Dict,
    RequestParams = Dict,
    RequestQuery = Dict,
  >(
    pathOrUrl: URL | string,
    options?: ConduitRequestOptions<
      ResponseData,
      RequestBody,
      RequestParams,
      RequestQuery
    >,
  ): Promise<ConduitResponse<ResponseData>>;

  post<ResponseData = any, RequestBody = Dict, RequestParams = Dict, RequestQuery = Dict>(
    pathOrUrl: URL | string,
    options?: ConduitRequestOptions<
      ResponseData,
      RequestBody,
      RequestParams,
      RequestQuery
    >,
  ): Promise<ConduitResponse<ResponseData>>;

  put<ResponseData = any, RequestBody = Dict, RequestParams = Dict, RequestQuery = Dict>(
    pathOrUrl: URL | string,
    options?: ConduitRequestOptions<
      ResponseData,
      RequestBody,
      RequestParams,
      RequestQuery
    >,
  ): Promise<ConduitResponse<ResponseData>>;

  request<
    ResponseData = any,
    RequestBody = Dict,
    RequestParams = Dict,
    RequestQuery = Dict,
  >(
    options: ConduitMethodOptions &
      ConduitRequestOptions<ResponseData, RequestBody, RequestParams, RequestQuery>,
  ): Promise<ConduitResponse<ResponseData>>;
}

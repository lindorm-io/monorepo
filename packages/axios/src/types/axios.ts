import { AnyObject } from "./util";
import { AxiosBasicCredentials as BasicCredentials, Method } from "axios";
import { AxiosMiddleware } from "./middleware";
import { Logger } from "@lindorm-io/winston";

export interface AxiosOptions {
  baseUrl?: string;
  logger: Logger;
  middleware?: Array<AxiosMiddleware>;
  name?: string;
}

export interface AxiosConfig {
  auth?: BasicCredentials;
  host: string;
  method: Method;
  path: string;
  protocol: string;
  timeout?: number;
  url?: string;
}

export interface AxiosRequest {
  data?: AnyObject;
  headers?: AnyObject;
  params?: AnyObject;
  query?: AnyObject;
}

export interface AxiosResponse<ResponseData> {
  data: ResponseData;
  headers: AnyObject;
  status?: number;
  statusText?: string;
}

export interface RequestConfig {
  auth?: BasicCredentials;
  method: Method;
  path: string;
  url?: string;
}

export interface RequestOptions extends AxiosRequest {
  middleware?: Array<AxiosMiddleware>;
  retry?: number;
  timeout?: number;
}

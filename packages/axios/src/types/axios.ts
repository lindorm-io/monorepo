import { AxiosBasicCredentials as BasicCredentials, Method } from "axios";
import { AxiosMiddleware } from "./middleware";
import { ILogger } from "@lindorm-io/winston";

export interface AxiosOptions {
  host?: string;
  port?: number;
  logger: ILogger;
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
  body?: Record<string, any>;
  headers?: Record<string, any>;
  params?: Record<string, any>;
  query?: Record<string, any>;
}

export interface AxiosResponse<ResponseData> {
  data: ResponseData;
  headers: Record<string, any>;
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
  attempt?: number;
  middleware?: Array<AxiosMiddleware>;
  retry?: number;
  timeout?: number;
}

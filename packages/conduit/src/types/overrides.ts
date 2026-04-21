import type { RawAxiosRequestConfig } from "axios";
import type { HttpMethod } from "@lindorm/types";

type RawAxiosRequestConfigOptions = Omit<
  RawAxiosRequestConfig,
  | "auth"
  | "baseURL"
  | "data"
  | "headers"
  | "method"
  | "params"
  | "paramsSerializer"
  | "timeout"
  | "transformRequest"
  | "transformResponse"
  | "url"
  | "validateStatus"
  | "withCredentials"
>;

type RawAxiosRequestConfigContext = Omit<
  RawAxiosRequestConfig,
  | "auth"
  | "baseURL"
  | "data"
  | "headers"
  | "method"
  | "params"
  | "paramsSerializer"
  | "transformRequest"
  | "transformResponse"
  | "url"
>;

export type ConfigOptions = RawAxiosRequestConfigOptions;

export type ConfigContext = RawAxiosRequestConfigContext & {
  method: Uppercase<HttpMethod>;
};

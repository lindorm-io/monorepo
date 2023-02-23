import { RawAxiosRequestConfig } from "axios";

export type RawAxiosRequestConfigOptions = Omit<
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

export type RawAxiosRequestConfigContext = Omit<
  RawAxiosRequestConfig,
  | "baseURL"
  | "data"
  | "headers"
  | "params"
  | "paramsSerializer"
  | "transformRequest"
  | "transformResponse"
  | "url"
>;

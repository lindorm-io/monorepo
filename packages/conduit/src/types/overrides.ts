import { RawAxiosRequestConfig } from "axios";
import { HttpMethod } from "@lindorm/types";

type FetchConfigOverride = {
  cache?:
    | "default"
    | "force-cache"
    | "no-cache"
    | "no-store"
    | "only-if-cached"
    | "reload";
  credentials?: RequestCredentials;
  integrity?: string;
  keepalive?: boolean;
  mode?: RequestMode;
  priority?: RequestPriority;
  redirect?: RequestRedirect;
  referrer?: string;
  referrerPolicy?: ReferrerPolicy;
  window?: null;
};

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

export type ConfigOptions = RawAxiosRequestConfigOptions & FetchConfigOverride;

export type ConfigContext = RawAxiosRequestConfigContext &
  FetchConfigOverride & {
    method: Uppercase<HttpMethod>;
  };

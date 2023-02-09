import UserAgent from "koa-useragent/dist/lib/useragent";
import { AuthorizationHeader } from "./authorization-header";
import { DefaultLindormContext } from "./lindorm-context";
import { Environment } from "@lindorm-io/common-types";
import { GetCookieOptions, SetCookieOptions } from "../util/private";
import { LindormKoaMetadata, LindormKoaMetadataHeaders } from "./metadata";
import { Metric } from "../class";
import { RouterContext } from "koa-router";
import { TransformMode } from "@lindorm-io/case";

interface KoaContext<Data = any> extends RouterContext {
  config: {
    transformMode: TransformMode;
  };
  data: Data;
  metadata: LindormKoaMetadata;
  metrics: Record<string, number>;
  server: {
    domain: string;
    environment: Environment;
    host: string;
  };
  userAgent: UserAgent;

  deleteCookie(name: string): void;
  getAuthorizationHeader(): AuthorizationHeader;
  getCookie(name: string, options?: Partial<GetCookieOptions>): string | undefined;
  getMetadataHeaders(): LindormKoaMetadataHeaders;
  getMetric(key: string): Metric;
  setCookie(name: string, value: string, options?: Partial<SetCookieOptions>): void;
}

export type DefaultLindormKoaContext<
  Context extends DefaultLindormContext = DefaultLindormContext,
  Data = any,
> = Context & KoaContext<Data>;

import { AuthorizationHeader } from "./authorization-header";
import { DefaultLindormContext } from "./lindorm-context";
import { Environment } from "../enum";
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

  getAuthorizationHeader(): AuthorizationHeader;
  getMetadataHeaders(): LindormKoaMetadataHeaders;
  getMetric(key: string): Metric;
  getCookie(name: string, options?: Partial<GetCookieOptions>): string | undefined;
  setCookie(name: string, value: string, options?: Partial<SetCookieOptions>): void;
  deleteCookie(name: string): void;
}

export type DefaultLindormKoaContext<
  Context extends DefaultLindormContext = DefaultLindormContext,
  Data = any,
> = Context & KoaContext<Data>;

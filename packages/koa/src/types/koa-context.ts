import UserAgent from "koa-useragent/dist/lib/useragent";
import { AuthorizationHeader } from "./authorization-header";
import { DefaultLindormContext } from "./lindorm-context";
import { Environment } from "@lindorm-io/common-types";
import { LindormKoaMetadata } from "./metadata";
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

  getAuthorizationHeader(): AuthorizationHeader;
  getMetric(key: string): Metric;
}

export type DefaultLindormKoaContext<
  Context extends DefaultLindormContext = DefaultLindormContext,
  Data = any,
> = Context & KoaContext<Data>;

import { TransformMode } from "@lindorm-io/case";
import { Environment } from "@lindorm-io/common-enums";
import { RouterContext } from "koa-router";
import UserAgent from "koa-useragent/dist/lib/useragent";
import { Metric } from "../class";
import { AuthorizationHeader } from "./authorization-header";
import { DefaultLindormContext } from "./lindorm-context";
import { LindormKoaMetadata } from "./metadata";

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

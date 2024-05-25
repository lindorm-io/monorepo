import { Environment } from "@lindorm/enums";
import { RetryConfig } from "@lindorm/retry";
import { Readable } from "stream";
import { ConfigContext } from "./overrides";
import { RetryCallback } from "./retry";

export type AppContext = {
  alias: string | null;
  baseUrl: string | null;
  environment: Environment | null;
};

export type RequestMetadata = {
  correlationId: string;
  requestId: string;
};

export type RequestContext<
  Body = Record<string, any>,
  Params = Record<string, any>,
  Query = Record<string, any>,
> = {
  body: Body | undefined;
  config: ConfigContext;
  filename: string | undefined;
  form: FormData | undefined;
  headers: Record<string, any>;
  metadata: RequestMetadata;
  params: Params;
  query: Query;
  retryCallback: RetryCallback;
  retryConfig: RetryConfig;
  stream: Readable | undefined;
  url: string;
};

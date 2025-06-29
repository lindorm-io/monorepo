import { Environment } from "@lindorm/enums";
import { RetryConfig } from "@lindorm/retry";
import { Dict } from "@lindorm/types";
import { Readable } from "stream";
import { ConfigContext } from "./overrides";
import { RetryCallback } from "./retry";

export type AppContext = {
  alias: string | null;
  baseURL: string | null;
  environment: Environment | null;
};

export type RequestMetadata = {
  correlationId: string;
  requestId: string;
  sessionId: string | null;
};

export type RequestContext<Body = Dict, Params = Dict, Query = Dict> = {
  body: Body | undefined;
  config: ConfigContext;
  filename: string | undefined;
  form: FormData | undefined;
  headers: Dict<string>;
  metadata: RequestMetadata;
  params: Params;
  query: Query;
  retryCallback: RetryCallback;
  retryConfig: RetryConfig;
  stream: Readable | undefined;
  url: string;
};

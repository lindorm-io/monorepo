import type { RetryConfig } from "@lindorm/retry";
import type { Dict, Environment } from "@lindorm/types";
import { Readable } from "stream";
import type { ConfigContext } from "./overrides.js";
import type { OnRetryCallback, RetryCallback } from "./retry.js";

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
  onDownloadProgress: ((event: { loaded: number; total?: number }) => void) | undefined;
  onRetry: OnRetryCallback | undefined;
  onUploadProgress: ((event: { loaded: number; total?: number }) => void) | undefined;
  origin: string;
  params: Params;
  query: Query;
  retryCallback: RetryCallback;
  retryConfig: RetryConfig;
  signal: AbortSignal | undefined;
  stream: Readable | undefined;
  url: string;
};

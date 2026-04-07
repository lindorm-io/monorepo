import { ILogger } from "@lindorm/logger";
import type { Middleware } from "@lindorm/middleware";
import type { Dict, Environment } from "@lindorm/types";

export type AppContext = {
  alias: string | null;
  url: string;
  environment: Environment | null;
};

export type MetadataContext = {
  correlationId: string;
  requestId: string;
  sessionId: string | null;
};

export type OutgoingContext<T = any> = {
  data: T;
  header: Dict;
};

export type IncomingContext<T = any> = {
  ok: boolean;
  data: T;
};

export type ZephyrContext<O = any, I = any> = {
  app: AppContext;
  event: string;
  logger?: ILogger;
  metadata: MetadataContext;
  incoming: IncomingContext<I>;
  outgoing: OutgoingContext<O>;
};

export type ZephyrMiddleware = Middleware<ZephyrContext>;

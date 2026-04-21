import type { ILogger } from "@lindorm/logger";
import { randomUUID } from "@lindorm/random";
import type { AppContext, ZephyrContext } from "../../types/context.js";

type CreateContextArgs = {
  app: AppContext;
  event: string;
  logger?: ILogger;
  data?: any;
  incoming?: boolean;
};

export const createZephyrContext = (args: CreateContextArgs): ZephyrContext => {
  const { app, event, logger, data, incoming = false } = args;

  return {
    app,
    event,
    logger,
    metadata: {
      correlationId: randomUUID(),
      requestId: randomUUID(),
    },
    outgoing: {
      data: incoming ? {} : (data ?? {}),
      header: {},
    },
    incoming: {
      data: incoming ? (data ?? {}) : {},
      ok: true,
    },
  };
};

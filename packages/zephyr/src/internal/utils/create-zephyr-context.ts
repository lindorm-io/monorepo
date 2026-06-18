import type { ILogger } from "@lindorm/logger";
import { randomId } from "@lindorm/random";
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
      correlationId: randomId({ namespace: "cor", length: 16 }),
      requestId: randomId({ namespace: "req", length: 16 }),
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

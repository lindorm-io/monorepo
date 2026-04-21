import { ClientError } from "@lindorm/errors";
import type { ILogger } from "@lindorm/logger";
import type { PylonHttpMiddleware } from "../../types/index.js";

export const createHttpContextInitialisationMiddleware = (
  logger: ILogger,
): PylonHttpMiddleware => {
  return async function httpContextInitialisationMiddleware(ctx, next) {
    ctx.body = {};
    ctx.status = ClientError.Status.NotFound;
    ctx.files = [];

    ctx.logger = logger.child(["Request"], {
      correlationId: ctx.state.metadata.correlationId,
      requestId: ctx.state.metadata.id,
      responseId: ctx.state.metadata.responseId,
    });

    await next();
  };
};

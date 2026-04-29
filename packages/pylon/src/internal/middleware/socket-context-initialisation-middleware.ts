import { isObject } from "@lindorm/is";
import type { ILogger } from "@lindorm/logger";
import type { Environment } from "@lindorm/types";
import { randomUUID } from "crypto";
import type { PylonSocketMiddleware } from "../../types/index.js";
import { getSocketAuthorization } from "../utils/get-socket-authorization.js";

const extractCorrelationId = (ctx: any): string => {
  if (typeof ctx.header?.correlationId === "string" && ctx.header.correlationId) {
    return ctx.header.correlationId;
  }
  if (
    isObject(ctx.data) &&
    typeof ctx.data.correlationId === "string" &&
    ctx.data.correlationId
  ) {
    return ctx.data.correlationId;
  }
  return randomUUID();
};

export const createSocketContextInitialisationMiddleware = (
  logger: ILogger,
): PylonSocketMiddleware => {
  return async function socketContextInitialisationMiddleware(ctx, next) {
    const correlationId = extractCorrelationId(ctx);

    ctx.state = {
      actor: "unknown",
      app: ctx.io.socket.data.app,
      authorization: getSocketAuthorization(ctx.io.socket),
      metadata: {
        id: ctx.eventId,
        correlationId,
        date: new Date(),
        environment:
          (ctx.io.socket.handshake?.headers?.["x-environment"] as Environment) ||
          "unknown",
      },
      tokens: ctx.io.socket.data.tokens ?? {},
    };

    ctx.logger = logger.child(["Event"], {
      correlationId,
      eventId: ctx.eventId,
      socketId: ctx.io.socket.id,
    });

    await next();
  };
};

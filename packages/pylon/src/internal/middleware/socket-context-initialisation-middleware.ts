import { ILogger } from "@lindorm/logger";
import { Environment } from "@lindorm/types";
import { randomUUID } from "crypto";
import { PylonSocketMiddleware } from "../../types";
import { getSocketAuthorization } from "../utils/get-socket-authorization";

export const createSocketContextInitialisationMiddleware = (
  logger: ILogger,
): PylonSocketMiddleware => {
  return async function socketContextInitialisationMiddleware(ctx, next) {
    ctx.state = {
      app: ctx.socket.data.app,
      authorization: getSocketAuthorization(ctx.socket),
      metadata: {
        id: ctx.eventId,
        correlationId: randomUUID(),
        date: new Date(),
        environment:
          (ctx.socket.handshake?.headers?.["x-environment"] as Environment) || "unknown",
      },
      tokens: ctx.socket.data.tokens ?? {},
    };

    ctx.logger = logger.child(["Event"], {
      eventId: ctx.eventId,
      socketId: ctx.socket.id,
    });

    await next();
  };
};

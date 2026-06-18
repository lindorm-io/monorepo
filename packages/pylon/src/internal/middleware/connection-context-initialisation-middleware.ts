import type { ILogger } from "@lindorm/logger";
import { randomId } from "@lindorm/random";
import type { Environment } from "@lindorm/types";
import type { PylonConnectionMiddleware } from "../../types/index.js";
import { getSocketAuthorization } from "../utils/get-socket-authorization.js";

export const createConnectionContextInitialisationMiddleware = (
  logger: ILogger,
): PylonConnectionMiddleware => {
  return async function connectionContextInitialisationMiddleware(ctx, next) {
    const correlationId =
      (ctx.io.socket.handshake?.headers?.["x-correlation-id"] as string) ??
      randomId({ namespace: "cor", length: 16 });

    ctx.state = {
      actor: "unknown",
      app: ctx.io.socket.data.app,
      authorization: getSocketAuthorization(ctx.io.socket),
      metadata: {
        id: ctx.handshakeId,
        correlationId,
        date: new Date(),
        environment:
          (ctx.io.socket.handshake?.headers?.["x-environment"] as Environment) ||
          "unknown",
      },
      tokens: ctx.io.socket.data.tokens ?? {},
    };

    ctx.logger = logger.child(["Handshake"], {
      correlationId,
      socketId: ctx.io.socket.id,
    });

    await next();
  };
};

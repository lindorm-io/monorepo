import { Aegis } from "@lindorm/aegis";
import { IAmphora } from "@lindorm/amphora";
import { Conduit } from "@lindorm/conduit";
import { ILogger } from "@lindorm/logger";
import { Environment } from "@lindorm/types";
import { randomUUID } from "crypto";
import { PylonSocketMiddleware } from "../../types";
import { getSocketAuthorization } from "../utils";

type Options = {
  amphora: IAmphora;
  logger: ILogger;
};

export const createSocketContextInitialisationMiddleware = (
  options: Options,
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

    ctx.logger = options.logger.child(["Event"], {
      eventId: ctx.eventId,
      socketId: ctx.socket.id,
    });

    ctx.amphora = options.amphora;

    ctx.aegis = new Aegis({
      amphora: ctx.amphora,
      logger: ctx.logger,
    });

    ctx.conduits = {
      conduit: new Conduit(),
    };

    ctx.entities = {};

    await next();
  };
};

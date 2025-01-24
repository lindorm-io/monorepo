import { Aegis } from "@lindorm/aegis";
import { IAmphora } from "@lindorm/amphora";
import { Conduit } from "@lindorm/conduit";
import { ILogger } from "@lindorm/logger";
import { PylonSocketMiddleware } from "../../types";

type Options = {
  amphora: IAmphora;
  logger: ILogger;
  issuer?: string;
};

export const createEventContextInitialisationMiddleware = (
  options: Options,
): PylonSocketMiddleware =>
  async function eventContextInitialisationMiddleware(ctx, next) {
    ctx.logger = options.logger.child(["Event"], {
      eventId: ctx.eventId,
      socketId: ctx.socket.id,
    });

    ctx.amphora = options.amphora;

    ctx.aegis = new Aegis({
      amphora: ctx.amphora,
      issuer: options.issuer,
      logger: ctx.logger,
    });

    ctx.conduits = {
      conduit: new Conduit(),
    };

    await next();
  };

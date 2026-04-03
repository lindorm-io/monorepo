import { Aegis } from "@lindorm/aegis";
import { IAmphora } from "@lindorm/amphora";
import { Conduit } from "@lindorm/conduit";
import { ServerError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import { Dict, Environment, Priority } from "@lindorm/types";
import { randomUUID } from "crypto";
import {
  PylonQueueOptions,
  PylonSocketMiddleware,
  PylonWebhookOptions,
} from "../../types";
import {
  createQueueCallback,
  createWebhookCallback,
  getSocketAuthorization,
} from "../utils";

type Options = {
  amphora: IAmphora;
  logger: ILogger;
  queue?: PylonQueueOptions<any>;
  webhook?: PylonWebhookOptions<any>;
};

export const createSocketContextInitialisationMiddleware = (
  options: Options,
): PylonSocketMiddleware => {
  const queue = createQueueCallback(options.queue);
  const webhook = createWebhookCallback(options.webhook);

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

    ctx.queue = async (
      event: string,
      payload: Dict = {},
      priority: Priority = "default",
      optional = false,
    ): Promise<void> => {
      if (!queue) {
        throw new ServerError("Queue callback is not configured");
      }
      try {
        await queue(ctx, event, payload, priority);
      } catch (err: any) {
        if (optional) {
          ctx.logger.warn("Failed to handle queue", err);
          return;
        }
        throw err;
      }
    };

    ctx.webhook = async (
      event: string,
      payload: Dict = {},
      optional = false,
    ): Promise<void> => {
      if (!webhook) {
        throw new ServerError("Webhook callback is not configured");
      }
      try {
        await webhook(ctx, event, payload);
      } catch (err: any) {
        if (optional) {
          ctx.logger.warn("Failed to handle webhook", err);
          return;
        }
        throw err;
      }
    };

    await next();
  };
};

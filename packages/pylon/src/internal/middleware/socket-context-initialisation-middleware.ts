import { Aegis } from "@lindorm/aegis";
import { IAmphora } from "@lindorm/amphora";
import { Conduit } from "@lindorm/conduit";
import { ILogger } from "@lindorm/logger";
import { Dict, Environment, Priority } from "@lindorm/types";
import { randomUUID } from "crypto";
import { PylonJob, PylonWebhookRequest } from "../../messages";
import {
  PylonQueueOptions,
  PylonSocketMiddleware,
  PylonWebhookOptions,
} from "../../types";
import { getSocketAuthorization, resolveIris } from "../utils";

const PRIORITY_MAP: Record<Priority, number> = {
  background: 0,
  low: 1,
  default: 5,
  medium: 6,
  high: 8,
  critical: 10,
};

type Options = {
  amphora: IAmphora;
  logger: ILogger;
  queue?: PylonQueueOptions;
  webhook?: PylonWebhookOptions;
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

    ctx.queue = async (
      event: string,
      payload: Dict = {},
      priority: Priority = "default",
      optional = false,
    ): Promise<void> => {
      try {
        const iris = resolveIris(ctx, options.queue?.iris);
        const wq = iris.workerQueue(PylonJob);
        const job = wq.create({
          correlationId: ctx.state.metadata.correlationId,
          event,
          payload,
        });
        await wq.publish(job, { priority: PRIORITY_MAP[priority] });
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
      try {
        const iris = resolveIris(ctx, options.webhook?.iris);
        const wq = iris.workerQueue(PylonWebhookRequest);
        const msg = wq.create({
          correlationId: ctx.state.metadata.correlationId,
          event,
          payload,
        });
        await wq.publish(msg);
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

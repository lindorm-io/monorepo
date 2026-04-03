import { Aegis } from "@lindorm/aegis";
import { IAmphora } from "@lindorm/amphora";
import { Conduit } from "@lindorm/conduit";
import { ClientError, ServerError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import { Dict, Priority } from "@lindorm/types";
import { PylonJob, PylonWebhookRequest } from "../../messages";
import { PylonHttpMiddleware } from "../../types";

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
};

export const createHttpContextInitialisationMiddleware = (
  options: Options,
): PylonHttpMiddleware => {
  return async function httpContextInitialisationMiddleware(ctx, next) {
    ctx.body = {};
    ctx.status = ClientError.Status.NotFound;

    ctx.logger = options.logger.child(["Request"], {
      correlationId: ctx.state.metadata.correlationId,
      requestId: ctx.state.metadata.id,
      responseId: ctx.state.metadata.responseId,
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

    ctx.files = [];

    ctx.queue = async (
      event: string,
      payload: Dict = {},
      priority: Priority = "default",
      optional = false,
    ): Promise<void> => {
      if (!ctx.iris) {
        throw new ServerError("IrisSource is not configured for queue");
      }
      try {
        const wq = ctx.iris.workerQueue(PylonJob);
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
      if (!ctx.iris) {
        throw new ServerError("IrisSource is not configured for webhook");
      }
      try {
        const wq = ctx.iris.workerQueue(PylonWebhookRequest);
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

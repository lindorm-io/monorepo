import { Aegis } from "@lindorm/aegis";
import { IAmphora } from "@lindorm/amphora";
import { Conduit } from "@lindorm/conduit";
import { Priority } from "@lindorm/enums";
import { ClientError, ServerError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { PylonMetric } from "../../classes/private";
import {
  OptionsQueueHandler,
  OptionsWebhookHandler,
  PylonHttpContext,
  PylonHttpMiddleware,
} from "../../types";

type Options<C extends PylonHttpContext = PylonHttpContext> = {
  amphora: IAmphora;
  logger: ILogger;
  queue?: OptionsQueueHandler<C>;
  webhook?: OptionsWebhookHandler<C>;
};

export const createHttpContextInitialisationMiddleware = <
  C extends PylonHttpContext = PylonHttpContext,
>(
  options: Options<C>,
): PylonHttpMiddleware<C> =>
  async function httpContextInitialisationMiddleware(ctx, next) {
    ctx.body = {};
    ctx.status = ClientError.Status.NotFound;

    ctx.logger = options.logger.child(["Request"], {
      correlationId: ctx.state.metadata.correlationId,
      requestId: ctx.state.metadata.requestId,
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

    ctx.queue = async (
      name: string,
      data: Dict = {},
      priority: Priority = Priority.Default,
      optional = false,
    ): Promise<void> => {
      if (!options.queue) {
        throw new ServerError("Queue handler is not configured");
      }
      try {
        await options.queue(ctx, name, data, priority);
      } catch (err: any) {
        if (optional) {
          ctx.logger.warn("Failed to handle queue", err);
          return;
        }
        throw err;
      }
    };

    ctx.metric = (name: string): PylonMetric =>
      new PylonMetric({ logger: ctx.logger, name });

    ctx.webhook = async (
      event: string,
      payload: Dict = {},
      optional = false,
    ): Promise<void> => {
      if (!options.webhook) {
        throw new ServerError("Webhook handler is not configured");
      }
      try {
        await options.webhook(ctx, event, payload);
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

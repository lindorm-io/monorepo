import { Aegis } from "@lindorm/aegis";
import { IAmphora } from "@lindorm/amphora";
import { Conduit } from "@lindorm/conduit";
import { ClientError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import { PylonMetric } from "../../classes/private";
import { PylonHttpMiddleware } from "../../types";

type Options = {
  amphora: IAmphora;
  logger: ILogger;
};

export const createHttpContextInitialisationMiddleware = (
  options: Options,
): PylonHttpMiddleware =>
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

    ctx.webhook = (event: string, data?: any): void => {
      ctx.state.webhooks.push({ event, data });
    };

    ctx.metric = (name: string): PylonMetric =>
      new PylonMetric({ logger: ctx.logger, name });

    await next();
  };

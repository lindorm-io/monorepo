import { Aegis } from "@lindorm/aegis";
import { IAmphora } from "@lindorm/amphora";
import { Conduit } from "@lindorm/conduit";
import { ClientError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import { PylonHttpMiddleware } from "../../types";

type Options = {
  amphora: IAmphora;
  logger: ILogger;
  issuer?: string;
};

export const createHttpContextInitialisationMiddleware = (
  options: Options,
): PylonHttpMiddleware =>
  async function httpContextInitialisationMiddleware(ctx, next) {
    try {
      ctx.body = {};
      ctx.status = ClientError.Status.NotFound;

      ctx.logger = options.logger.child(["Request"], {
        correlationId: ctx.metadata.correlationId,
        requestId: ctx.metadata.requestId,
        responseId: ctx.metadata.responseId,
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

      ctx.tokens = {};

      ctx.webhook = { event: null, data: undefined };
    } catch (err: any) {
      ctx.status = ClientError.Status.BadRequest;
      ctx.body = {
        error: {
          code: err.code ?? "unknown_error",
          data: err.data ?? {},
          message: err.message,
          name: err.name ?? "Error",
          title: err.title ?? "Error",
        },
      };

      throw err;
    }

    await next();
  };

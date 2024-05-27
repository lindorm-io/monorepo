import { Environment } from "@lindorm/enums";
import { ClientError } from "@lindorm/errors";
import { randomUUID } from "crypto";
import { PylonHttpMiddleware } from "../../types";

type Options = {
  environment: Environment;
  version: string;
};

export const createHttpMetadataMiddleware = (options: Options): PylonHttpMiddleware =>
  async function httpMetadataMiddleware(ctx, next) {
    try {
      const requestDate = ctx.get("date");

      ctx.metadata = {
        correlationId: ctx.get("x-correlation-id") || randomUUID(),
        date: requestDate ? new Date(requestDate) : new Date(),
        environment: (ctx.get("x-environment") as Environment) || Environment.Unknown,
        requestId: ctx.get("x-request-id") || randomUUID(),
        responseId: randomUUID(),
      };

      ctx.set("X-Correlation-ID", ctx.metadata.correlationId);
      ctx.set("X-Request-ID", ctx.metadata.requestId);
      ctx.set("X-Response-ID", ctx.metadata.responseId);
      ctx.set("X-Server-Environment", options.environment);
      ctx.set("X-Server-Version", options.version);
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

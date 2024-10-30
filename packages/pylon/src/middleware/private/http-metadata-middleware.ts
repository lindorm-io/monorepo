import {
  addMilliseconds,
  isAfter,
  isBefore,
  ms,
  ReadableTime,
  subMilliseconds,
} from "@lindorm/date";
import { Environment } from "@lindorm/enums";
import { ClientError } from "@lindorm/errors";
import { randomUUID } from "crypto";
import { PylonHttpMiddleware } from "../../types";

type Options = {
  environment: Environment;
  httpMaxRequestAge: ReadableTime;
  version: string;
};

export const createHttpMetadataMiddleware = (options: Options): PylonHttpMiddleware =>
  async function httpMetadataMiddleware(ctx, next) {
    try {
      const requestDate = ctx.get("date");

      const minDate = subMilliseconds(new Date(), ms(options.httpMaxRequestAge));
      const maxDate = addMilliseconds(new Date(), ms(options.httpMaxRequestAge));

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

      if (isBefore(ctx.metadata.date, minDate)) {
        throw new ClientError("Request has been identified as a likely replay attack", {
          code: "replay_error",
          data: {
            actual: ctx.metadata.date.toISOString(),
            expect: minDate.toISOString(),
          },
        });
      }

      if (isAfter(ctx.metadata.date, maxDate)) {
        throw new ClientError("Request has been identified as suspicious", {
          code: "suspicious_request",
          data: {
            actual: ctx.metadata.date.toISOString(),
            expect: maxDate.toISOString(),
          },
        });
      }
    } catch (err: any) {
      ctx.status = ClientError.Status.BadRequest;
      ctx.body = {
        error: {
          code: err.code ?? "unexpected_error",
          data: err.data ?? {},
          message: err.message,
          name: err.name ?? "Error",
          title: err.title ?? "Unexpected Error",
        },
      };
      return;
    }

    await next();
  };

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

      ctx.state = {
        metadata: {
          correlationId: ctx.get("x-correlation-id") || randomUUID(),
          date: requestDate ? new Date(requestDate) : new Date(),
          environment: (ctx.get("x-environment") as Environment) || Environment.Unknown,
          origin: ctx.get("x-origin") || ctx.get("origin") || null,
          requestId: ctx.get("x-request-id") || randomUUID(),
          responseId: randomUUID(),
          sessionId: null,
        },
        session: null,
        tokens: {},
      };

      if (isBefore(ctx.state.metadata.date, minDate)) {
        throw new ClientError("Replay Attack", {
          code: "replay_error",
          details: "Request has been identified as a likely replay attack",
          data: {
            actual: ctx.state.metadata.date.toISOString(),
            expect: minDate.toISOString(),
          },
        });
      }

      if (isAfter(ctx.state.metadata.date, maxDate)) {
        throw new ClientError("Suspicious Request", {
          code: "suspicious_request",
          details: "Request has been identified as suspicious",
          data: {
            actual: ctx.state.metadata.date.toISOString(),
            expect: maxDate.toISOString(),
          },
        });
      }

      await next();
    } finally {
      ctx.set("x-correlation-id", ctx.state.metadata.correlationId);
      ctx.set("x-request-id", ctx.state.metadata.requestId);
      ctx.set("x-response-id", ctx.state.metadata.responseId);
      ctx.set("x-server-environment", options.environment);
      ctx.set("x-server-version", options.version);
      ctx.set("x-session-id", ctx.state.metadata.sessionId ?? "");
    }
  };

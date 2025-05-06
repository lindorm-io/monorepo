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
import { getAuthorization } from "../../utils/private";

type Options = {
  environment?: Environment;
  minRequestAge: ReadableTime;
  maxRequestAge: ReadableTime;
  name?: string;
  version?: string;
};

export const createHttpStateMiddleware = (options: Options): PylonHttpMiddleware => {
  const environment = options.environment || Environment.Unknown;
  const name = options.name ?? "unknown";
  const version = options.version ?? "0.0.0";

  return async function httpStateMiddleware(ctx, next) {
    try {
      const requestDate = ctx.get("date");

      const minDate = subMilliseconds(new Date(), ms(options.minRequestAge));
      const maxDate = addMilliseconds(new Date(), ms(options.maxRequestAge));

      ctx.state = {
        app: { environment, name, version },
        authorization: getAuthorization(ctx),
        metadata: {
          correlationId: ctx.get("x-correlation-id") || randomUUID(),
          date: requestDate ? new Date(requestDate) : new Date(),
          environment: (ctx.get("x-environment") as Environment) || Environment.Unknown,
          origin: ctx.get("x-origin") || ctx.get("origin") || null,
          requestId: ctx.get("x-request-id") || randomUUID(),
          responseId: randomUUID(),
          sessionId: ctx.get("x-session-id") || null,
        },
        session: null,
        tokens: {},
      };

      if (isBefore(ctx.state.metadata.date, minDate)) {
        throw new ClientError("Suspicious request denied", {
          code: "replay_denied",
          details: "Request has been identified as a likely replay attack",
          data: {
            actual: ctx.state.metadata.date.toISOString(),
            expect: minDate.toISOString(),
          },
        });
      }

      if (isAfter(ctx.state.metadata.date, maxDate)) {
        throw new ClientError("Suspicious request denied", {
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
      ctx.set("x-server-environment", environment);
      ctx.set("x-server-name", name);
      ctx.set("x-server-version", version);
      ctx.set("x-session-id", ctx.state.metadata.sessionId ?? "");
    }
  };
};

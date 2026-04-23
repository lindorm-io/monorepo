import type { Environment } from "@lindorm/types";
import { randomUUID } from "crypto";
import type { PylonHttpMiddleware } from "../../types/index.js";
import { getAuthorization } from "../utils/get-authorization.js";

type Options = {
  environment?: Environment;
  name?: string;
  domain?: string;
  version?: string;
};

export const createHttpStateMiddleware = (options: Options): PylonHttpMiddleware => {
  const domain = options.domain ?? "unknown";
  const environment = options.environment || "unknown";
  const name = options.name ?? "unknown";
  const version = options.version ?? "0.0.0";

  return async function httpStateMiddleware(ctx, next) {
    try {
      const requestDate = ctx.get("date");

      ctx.state = {
        actor: "unknown",
        app: { domain, environment, name, version },
        authorization: getAuthorization(ctx),
        metadata: {
          id: ctx.get("x-request-id") || randomUUID(),
          correlationId: ctx.get("x-correlation-id") || randomUUID(),
          date: requestDate ? new Date(requestDate) : new Date(),
          environment: (ctx.get("x-environment") as Environment) || "unknown",
          origin: ctx.get("x-origin") || ctx.get("origin") || null,
          responseId: randomUUID(),
          sessionId: ctx.get("x-session-id") || null,
        },
        origin: ctx.request.origin || `${ctx.protocol}://${ctx.host}`,
        session: null,
        tokens: {},
      };

      await next();
    } finally {
      ctx.set("x-correlation-id", ctx.state.metadata.correlationId);
      ctx.set("x-request-id", ctx.state.metadata.id);
      ctx.set("x-response-id", ctx.state.metadata.responseId);
      ctx.set("x-server-environment", environment);
      ctx.set("x-server-name", name);
      ctx.set("x-server-version", version);
      ctx.set("x-session-id", ctx.state.metadata.sessionId ?? "");
    }
  };
};

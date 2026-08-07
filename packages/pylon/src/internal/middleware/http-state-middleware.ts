import { lindormId } from "@lindorm/random";
import type { Environment } from "@lindorm/types";
import type { AppConfig, PylonHttpMiddleware } from "../../types/index.js";
import { buildClientContext } from "../utils/build-client-context.js";
import { getAuthorization } from "../utils/get-authorization.js";

type Options = {
  /**
   * The deployment's resolved policy, built ONCE by `buildAppConfig` after
   * `amphora.setup()`. Handed in rather than derived here: it is the same object
   * the socket transport serves, and deriving it twice is how the two drift.
   */
  config: AppConfig;
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
  const config = options.config;

  return async function httpStateMiddleware(ctx, next) {
    try {
      const requestDate = ctx.get("date");

      ctx.state = {
        access: null,
        actor: "unknown",
        app: { config, domain, environment, name, version },
        authorization: getAuthorization(ctx),
        client: buildClientContext(
          ctx.get("user-agent") || null,
          (name) => ctx.get(name) || undefined,
        ),
        metadata: {
          id: ctx.get("x-request-id") || lindormId({ namespace: "req", length: 16 }),
          correlationId:
            ctx.get("x-correlation-id") || lindormId({ namespace: "cor", length: 16 }),
          date: requestDate ? new Date(requestDate) : new Date(),
          environment: (ctx.get("x-environment") as Environment) || "unknown",
          origin: ctx.get("x-origin") || ctx.get("origin") || null,
          responseId: lindormId({ namespace: "res", length: 16 }),
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

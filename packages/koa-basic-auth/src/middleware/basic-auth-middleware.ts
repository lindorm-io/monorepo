import { Credentials } from "../types";
import { KoaContext, Middleware } from "@lindorm-io/koa";
import { getCredentials, validateCredentials } from "../utils";
import { ClientError, ServerError } from "@lindorm-io/errors";

interface Options {
  clients: Array<Credentials>;
}

export const basicAuthMiddleware =
  (options: Options): Middleware<KoaContext> =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("auth");

    if (!options.clients.length) {
      metric.end();

      throw new ServerError("Invalid server initialisation", {
        debug: { clients: options.clients },
        statusCode: ServerError.StatusCode.NOT_IMPLEMENTED,
      });
    }

    const authorization = ctx.getAuthorizationHeader();

    ctx.logger.debug("authorization header exists", { authorization });

    if (authorization?.type !== "Basic") {
      metric.end();

      throw new ClientError("Invalid Authorization", {
        description: "Expected: Basic Authorization",
        statusCode: ClientError.StatusCode.UNAUTHORIZED,
      });
    }

    ctx.logger.debug("basic auth identified", { credentials: authorization.value });

    const credentials = getCredentials(authorization.value);
    validateCredentials(credentials, options.clients);

    ctx.logger.verbose("basic auth validated", { username: credentials.username });

    metric.end();

    await next();
  };

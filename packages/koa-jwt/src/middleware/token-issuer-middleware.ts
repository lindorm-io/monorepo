import { Middleware } from "@lindorm-io/koa";
import { ServerError } from "@lindorm-io/errors";
import { TokenIssuer } from "@lindorm-io/jwt";
import { TokenIssuerContext } from "../types";

interface Options {
  issuer: string;
}

export const tokenIssuerMiddleware =
  (options: Options): Middleware<TokenIssuerContext> =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("jwt");

    if (!ctx.keystore) {
      throw new ServerError("Invalid keystore", {
        debug: { notes: "Keystore not set" },
        statusCode: ServerError.StatusCode.NOT_IMPLEMENTED,
      });
    }

    if (ctx.keystore.getKeys().length === 0) {
      throw new ServerError("Invalid keystore", {
        debug: { notes: "Unable to get any valid keys" },
        statusCode: ServerError.StatusCode.NOT_IMPLEMENTED,
      });
    }

    ctx.jwt = new TokenIssuer({
      issuer: options.issuer,
      keystore: ctx.keystore,
      logger: ctx.logger,
    });

    metric.end();

    await next();
  };

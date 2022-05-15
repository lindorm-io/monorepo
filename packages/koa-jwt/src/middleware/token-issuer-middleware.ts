import { DefaultLindormJwtKoaMiddleware } from "../types";
import { getTokenIssuer } from "../util";

interface Options {
  issuer: string;
}

export const tokenIssuerMiddleware =
  (options: Options): DefaultLindormJwtKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("jwt");

    ctx.jwt = getTokenIssuer(ctx, options.issuer);

    metric.end();

    await next();
  };

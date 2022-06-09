import { DefaultLindormJwtKoaMiddleware } from "../types";
import { getJwt } from "../util";

interface Options {
  issuer: string;
}

export const jwtMiddleware =
  (options: Options): DefaultLindormJwtKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("jwt");

    ctx.jwt = getJwt(ctx, options.issuer);

    metric.end();

    await next();
  };

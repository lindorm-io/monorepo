import { transformCase, TransformMode } from "@lindorm-io/case";
import { Middleware } from "../../types";

export const axiosTransformResponseDataMiddleware =
  (mode: TransformMode): Middleware =>
  async (ctx, next) => {
    await next();
    ctx.res.data = ctx.res.data ? transformCase(ctx.res.data, mode) : ctx.res.data;
  };

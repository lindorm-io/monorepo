import { Middleware } from "../types";
import { transformCase, TransformMode } from "@lindorm-io/case";

export const axiosTransformBodyCaseMiddleware =
  (requestMode: TransformMode = "snake", responseMode: TransformMode = "camel"): Middleware =>
  async (ctx, next) => {
    ctx.req.body = ctx.req.body ? transformCase(ctx.req.body, requestMode) : ctx.req.body;
    await next();
    ctx.res.data = ctx.res.data ? transformCase(ctx.res.data, responseMode) : ctx.res.data;
  };

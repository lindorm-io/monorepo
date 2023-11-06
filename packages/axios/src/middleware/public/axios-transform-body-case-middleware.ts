import { transformCase, TransformMode } from "@lindorm-io/case";
import { Middleware } from "../../types";

export const axiosTransformBodyCaseMiddleware =
  (
    requestMode: TransformMode = TransformMode.SNAKE,
    responseMode: TransformMode = TransformMode.CAMEL,
  ): Middleware =>
  async (ctx, next) => {
    ctx.req.body = ctx.req.body ? transformCase(ctx.req.body, requestMode) : ctx.req.body;
    await next();
    ctx.res.data = ctx.res.data ? transformCase(ctx.res.data, responseMode) : ctx.res.data;
  };

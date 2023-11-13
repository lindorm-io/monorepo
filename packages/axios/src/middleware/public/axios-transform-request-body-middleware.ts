import { transformCase, TransformMode } from "@lindorm-io/case";
import { Middleware } from "../../types";

export const axiosTransformRequestBodyMiddleware =
  (mode: TransformMode): Middleware =>
  async (ctx, next) => {
    ctx.req.body = ctx.req.body ? transformCase(ctx.req.body, mode) : ctx.req.body;
    await next();
  };

import { Middleware } from "../types";
import { transformCase, TransformMode } from "@lindorm-io/case";

export const axiosTransformQueryCaseMiddleware =
  (mode: TransformMode = "snake"): Middleware =>
  async (ctx, next) => {
    ctx.req.query = transformCase(ctx.req.query, mode);
    await next();
  };

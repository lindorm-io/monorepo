import { transformCase, TransformMode } from "@lindorm-io/case";
import { Middleware } from "../../types";

export const axiosTransformQueryCaseMiddleware =
  (mode: TransformMode = TransformMode.SNAKE): Middleware =>
  async (ctx, next) => {
    ctx.req.query = transformCase(ctx.req.query, mode);
    await next();
  };

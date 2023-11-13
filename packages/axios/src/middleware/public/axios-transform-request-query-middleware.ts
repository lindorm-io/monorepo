import { transformCase, TransformMode } from "@lindorm-io/case";
import { Middleware } from "../../types";

export const axiosTransformRequestQueryMiddleware =
  (mode: TransformMode): Middleware =>
  async (ctx, next) => {
    const { query } = ctx.req;

    if (query && typeof query === "object") {
      ctx.req.query = transformCase(query, mode);
    }

    await next();
  };

import { transformCase, TransformMode } from "@lindorm-io/case";
import { Middleware } from "../../types";

export const axiosTransformRequestBodyMiddleware =
  (mode: TransformMode): Middleware =>
  async (ctx, next) => {
    const { body } = ctx.req;

    if (body && typeof body === "object") {
      ctx.req.body = transformCase(body, mode);
    }

    await next();
  };

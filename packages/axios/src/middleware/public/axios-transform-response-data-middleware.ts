import { transformCase, TransformMode } from "@lindorm-io/case";
import { Middleware } from "../../types";

export const axiosTransformResponseDataMiddleware =
  (mode: TransformMode): Middleware =>
  async (ctx, next) => {
    await next();

    const { data } = ctx.res;

    if (data && Array.isArray(data)) {
      ctx.res.data = transformCase<{ data: any }>({ data }, mode).data;
    } else if (data && typeof data === "object") {
      ctx.res.data = transformCase(data, mode);
    }
  };

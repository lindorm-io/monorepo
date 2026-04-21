import { ServerError } from "@lindorm/errors";
import type { PylonConnectionMiddleware } from "../../types/index.js";

export const connectionErrorHandlerMiddleware: PylonConnectionMiddleware = async (
  ctx,
  next,
) => {
  try {
    await next();
  } catch (err: any) {
    const status = err.status ?? err.statusCode ?? ServerError.Status.InternalServerError;

    if (status >= 500) {
      ctx.logger?.error("Connection server error", err);
    } else {
      ctx.logger?.warn("Connection client error", err);
    }

    throw err;
  }
};

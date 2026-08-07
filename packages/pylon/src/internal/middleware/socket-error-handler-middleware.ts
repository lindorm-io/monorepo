import type { PylonSocketMiddleware } from "../../types/index.js";
import { resolveErrorStatus } from "../utils/resolve-error-status.js";

export const socketErrorHandlerMiddleware: PylonSocketMiddleware = async (ctx, next) => {
  try {
    await next();
  } catch (err: any) {
    try {
      const status = resolveErrorStatus(err);

      if (status >= 500) {
        ctx.logger.error("Server error", err);
      } else {
        ctx.logger.warn("Client error", err);
      }

      ctx.io.socket.emit("error", {
        code: err.code ?? "unknown_error",
        data: err.data ?? {},
        message: err.message,
        name: err.name ?? "Error",
        title: err.title ?? "Error",
      });
    } catch {
      ctx.io.socket.emit("error", {
        code: "unexpected_exception",
        data: {},
        name: "UnexpectedException",
        title: "Unexpected Exception",
        message: "An unexpected exception occurred while handling thrown error",
      });
    }
  }
};

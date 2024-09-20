import { ServerError } from "@lindorm/errors";
import { PylonEventMiddleware } from "../../types";

export const eventErrorHandlerMiddleware: PylonEventMiddleware = async (ctx, next) => {
  try {
    await next();
  } catch (err: any) {
    try {
      const status =
        err.status ?? err.statusCode ?? ServerError.Status.InternalServerError;

      if (status >= 500) {
        ctx.logger.error("Server error", err);
      } else {
        ctx.logger.warn("Client error", err);
      }

      ctx.socket.emit("error", {
        code: err.code ?? "unknown_error",
        data: err.data ?? {},
        message: err.message,
        name: err.name ?? "Error",
        title: err.title ?? "Error",
      });
    } catch (_) {
      ctx.socket.emit("error", {
        code: "unexpected_exception",
        data: {},
        name: "UnexpectedException",
        title: "Unexpected Exception",
        message: "An unexpected exception occurred while handling thrown error",
      });
    }
  }
};

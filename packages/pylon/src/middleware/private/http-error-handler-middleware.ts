import { ServerError } from "@lindorm/errors";
import { RedirectError } from "../../errors";
import { PylonHttpMiddleware } from "../../types";

export const httpErrorHandlerMiddleware: PylonHttpMiddleware = async (ctx, next) => {
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

      if (err instanceof RedirectError) {
        const url = new URL(err.redirect);

        if (err.code?.length) {
          url.searchParams.append("error", err.code);
        }
        if (err.uri?.length) {
          url.searchParams.append("error_uri", err.uri);
        }
        if (err.state?.length) {
          url.searchParams.append("state", err.state);
        }

        ctx.redirect(url.toString());
      } else {
        ctx.status = status;
        ctx.body = {
          error: {
            code: err.code ?? "unknown_error",
            data: err.data ?? {},
            message: err.message,
            name: err.name ?? "Error",
            title: err.title ?? "Error",
          },
        };
      }
    } catch (err) {
      ctx.status = ServerError.Status.InternalServerError;
      ctx.body = {
        error: {
          code: "unexpected_exception",
          data: {},
          name: "UnexpectedException",
          title: "Unexpected Exception",
          message: "An unexpected exception occurred while handling thrown error",
        },
      };
    }
  }
};

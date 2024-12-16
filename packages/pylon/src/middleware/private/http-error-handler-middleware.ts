import { ServerError } from "@lindorm/errors";
import { randomBytes, randomUUID } from "crypto";
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
            id: err.id ?? randomUUID(),
            code: err.code ?? "unknown_error",
            data: err.data ?? {},
            message: err.message,
            name: err.name ?? "Error",
            support: randomBytes(8).toString("base64url"),
            title: err.title ?? "Error",
          },
          server: "Pylon",
        };
      }
    } catch (_) {
      ctx.status = ServerError.Status.InternalServerError;
      ctx.body = {
        error: {
          id: err.id ?? randomUUID(),
          code: "unexpected_exception",
          data: {},
          message: "An unexpected exception occurred while handling thrown error",
          name: "UnexpectedException",
          support: randomBytes(8).toString("base64url"),
          title: "Unexpected Exception",
        },
        server: "Pylon",
      };
    }
  }
};

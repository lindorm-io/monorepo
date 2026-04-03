import { ServerError } from "@lindorm/errors";
import { isNumber, isString } from "@lindorm/is";
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

      if (err instanceof RedirectError) {
        const url = new URL(err.redirect);

        if (isNumber(err.code) || (isString(err.code) && err.code.length)) {
          url.searchParams.append("error", String(err.code));
        }
        if (err.uri?.length) {
          url.searchParams.append("error_uri", err.uri);
        }
        if (err.support?.length) {
          url.searchParams.append("support", err.support);
        }
        if (err.state?.length) {
          url.searchParams.append("state", err.state);
        }

        ctx.redirect(url.toString());
      } else {
        ctx.status = status;
        ctx.body = {
          __meta: {
            app: "Pylon",
            environment: ctx.state?.app?.environment,
            name: ctx.state?.app?.name,
            version: ctx.state?.app?.version,
          },
          error: {
            id: err.id ?? randomUUID(),
            name: err.name ?? "Error",
            title: err.title ?? "Error",
            message: err.message,
            code: err.code ?? "unknown_error",
            support: err.support ?? randomBytes(8).toString("base64url"),
            data: err.data ?? {},
          },
        };
      }
    } catch {
      ctx.status = ServerError.Status.InternalServerError;
      ctx.body = {
        __meta: {
          app: "Pylon",
          environment: ctx.state?.app?.environment,
          name: ctx.state?.app?.name,
          version: ctx.state?.app?.version,
        },
        error: {
          id: err.id ?? randomUUID(),
          name: "UnexpectedException",
          title: "Unexpected Exception",
          message: "An unexpected exception occurred while handling thrown error",
          code: "unexpected_exception",
          support: randomBytes(8).toString("base64url"),
          data: {},
        },
      };
    }
  }
};

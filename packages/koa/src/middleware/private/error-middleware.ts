import { RedirectError } from "@lindorm-io/errors";
import { HttpStatus } from "../../constant";
import { DefaultLindormMiddleware } from "../../types";

export const errorMiddleware: DefaultLindormMiddleware = async (ctx, next): Promise<void> => {
  try {
    await next();
  } catch (err: any) {
    try {
      const status = err.statusCode || err.status || HttpStatus.ServerError.INTERNAL_SERVER_ERROR;

      if (status >= 500) {
        ctx.logger.error("Service caught unexpected error", err);
      } else {
        ctx.logger.warn("Service caught client error", err);
      }

      if (err instanceof RedirectError) {
        const url = new URL(err.redirect);

        if (err.code?.length) {
          url.searchParams.append("error", encodeURI(err.code));
        }
        if (err.description?.length) {
          url.searchParams.append("error_description", encodeURI(err.description));
        }
        if (err.uri?.length) {
          url.searchParams.append("error_uri", encodeURI(err.uri));
        }
        if (err.state?.length) {
          url.searchParams.append("state", encodeURI(err.state));
        }

        ctx.redirect(url.toString());
      } else {
        ctx.status = status;
        ctx.body = {
          error: {
            code: err.code || null,
            data: err.data || {},
            description: err.description || null,
            message: err.message,
            name: err.name || null,
            title: err.title || null,
          },
        };
      }
    } catch (err) {
      ctx.status = HttpStatus.ServerError.INTERNAL_SERVER_ERROR;
      ctx.body = {
        error: {
          name: "UnexpectedError",
          title: "Unexpected Error",
          message: "Something went wrong",
        },
      };

      ctx.app.emit("error", err);
    }
  }
};

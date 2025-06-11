import { ServerError } from "@lindorm/errors";
import { PylonHandler, PylonHttpContext, PylonHttpMiddleware } from "../../types";
import { getBody, getFile, getStatus } from "../../utils/private";

export const useHandler = <C extends PylonHttpContext = PylonHttpContext>(
  handler: PylonHandler<C>,
): PylonHttpMiddleware<C> =>
  async function httpHandlerMiddleware(ctx, next) {
    const metric = ctx.metric("httpHandlerMiddleware");

    ctx.logger = ctx.logger.child([
      handler.name || handler.constructor.name || "handler",
    ]);

    ctx.logger.debug("Handler [ start ]", { data: ctx.data });

    try {
      const result = (await handler(ctx)) || {};

      ctx.body = getBody(result);
      ctx.status = getStatus(result);

      if (result.location) {
        ctx.set("location", result.location.toString());
      }

      if (result.redirect && (result.file || result.stream)) {
        throw new ServerError("Redirect cannot be used with file download");
      }

      if (result.redirect) {
        ctx.redirect(result.redirect.toString());
      }

      if (result.file || result.stream) {
        const download = result.stream
          ? result.stream
          : result.file
            ? await getFile(ctx, result.file)
            : undefined;

        if (download) {
          ctx.set(
            "cache-control",
            [
              `max-age=${download.maxAge ?? 0}`,
              ...(download.immutable ? ["immutable"] : []),
            ].join(","),
          );
          ctx.set(
            "content-disposition",
            `attachment; filename=${download.filename ?? "download"}`,
          );
          ctx.set("content-length", download.contentLength.toString());
          ctx.set("content-type", "application/octet-stream");
          ctx.set("last-modified", download.lastModified.toUTCString());

          ctx.type = download.mimeType;
          ctx.body = download.stream;
        }
      }

      ctx.logger.debug("Handler [ success ]", {
        body: Boolean(ctx.body),
        file: Boolean(result.file),
        location: result.location,
        redirect: result.redirect,
        status: ctx.status,
        stream: Boolean(result.stream),
      });
    } catch (err: any) {
      ctx.logger.warn("Handler [ failure ]", err);

      throw err;
    } finally {
      metric.end();
    }

    await next();
  };

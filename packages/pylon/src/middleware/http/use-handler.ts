import { ServerError } from "@lindorm/errors";
import { PylonHandler, PylonHttpContext, PylonHttpMiddleware } from "../../types";
import { getBody, getFile, getStatus } from "../../utils/private";

export const useHandler = <C extends PylonHttpContext = PylonHttpContext>(
  handler: PylonHandler<C>,
): PylonHttpMiddleware<C> =>
  async function httpHandlerMiddleware(ctx, next) {
    const start = Date.now();

    ctx.logger = ctx.logger.child([
      handler.name || handler.constructor.name || "handler",
    ]);

    ctx.logger.debug("Handler [ start ]", { data: ctx.data });

    try {
      const result = (await handler(ctx)) || {};

      ctx.body = getBody(result);
      ctx.status = getStatus(result);

      ctx.webhook = {
        event: result.webhook?.event ?? null,
        data: result.webhook?.data ?? undefined,
      };

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
            "Cache-Control",
            [
              `max-age=${download.maxAge ?? 0}`,
              ...(download.immutable ? ["immutable"] : []),
            ].join(","),
          );
          ctx.set(
            "Content-Disposition",
            `attachment; filename=${download.filename ?? "download"}`,
          );
          ctx.set("Content-Length", download.contentLength.toString());
          ctx.set("Content-Type", "application/octet-stream");
          ctx.set("Last-Modified", download.lastModified.toUTCString());

          ctx.type = download.mimeType;
          ctx.body = download.stream;
        }
      }

      ctx.logger.debug("Handler [ success ]", {
        body: Boolean(ctx.body),
        file: Boolean(result.file),
        redirect: result.redirect,
        status: ctx.status,
        stream: Boolean(result.stream),
        webhook: Boolean(result.webhook),
        time: Date.now() - start,
      });
    } catch (error: any) {
      ctx.logger.debug("Handler [ failure ]", {
        error,
        time: Date.now() - start,
      });

      throw error;
    }

    await next();
  };

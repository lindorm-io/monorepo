import { PylonHttpContext, PylonHttpMiddleware, WebhookHandler } from "../../types";

export const useWebhook = <C extends PylonHttpContext = PylonHttpContext>(
  handler: WebhookHandler<C>,
): PylonHttpMiddleware<C> =>
  async function httpWebhookMiddleware(ctx, next) {
    const start = Date.now();

    const {
      logger,
      webhook: { event, data },
    } = ctx;

    logger.debug("Webhook [ start ]", { event, data: data ? Object.keys(data) : [] });

    try {
      const result = await handler(ctx);

      logger.debug("Webhook [ success ]", {
        result,
        time: Date.now() - start,
      });
    } catch (error: any) {
      logger.debug("Webhook [ failure ]", {
        error,
        time: Date.now() - start,
      });
    }

    await next();
  };

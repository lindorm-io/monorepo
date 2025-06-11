import { ServerError } from "@lindorm/errors";
import { OptionsHandler, PylonHttpContext, PylonHttpMiddleware } from "../../types";

export const createHttpWebhookMiddleware = <
  C extends PylonHttpContext = PylonHttpContext,
>(
  handler?: OptionsHandler<C>,
): PylonHttpMiddleware<C> =>
  async function httpWebhookMiddleware(ctx, next) {
    await next();

    if (ctx.state.webhooks.length) {
      if (!handler) {
        throw new ServerError("Webhook handler is not defined");
      }

      const metric = ctx.metric("httpWebhookMiddleware");

      try {
        ctx.logger.debug("Webhook [ start ]", { amount: ctx.state.webhooks.length });

        await handler(ctx);

        ctx.logger.debug("Webhook [ success ]");
      } catch (err: any) {
        ctx.logger.error("Webhook [ failure ]", err);
      } finally {
        metric.end();
      }
    }
  };

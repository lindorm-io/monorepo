import { ServerError } from "@lindorm/errors";
import type { Middleware } from "@lindorm/middleware";
import type { Dict } from "@lindorm/types";
import type { PylonContext, PylonWebhookOptions } from "../../types/index.js";
import { resolveIris } from "../utils/resolve-iris.js";

export const createWebhookMiddleware = <C extends PylonContext>(
  options?: PylonWebhookOptions,
): Middleware<C> => {
  if (!options?.enabled) {
    return async function disabledWebhookMiddleware(ctx, next) {
      ctx.webhook = async (): Promise<never> => {
        throw new ServerError("Webhook is not enabled");
      };
      await next();
    };
  }

  return async function webhookMiddleware(ctx, next) {
    ctx.webhook = async (
      event: string,
      payload: Dict = {},
      optional = false,
    ): Promise<void> => {
      try {
        const iris = resolveIris(ctx, options.iris);
        const { WebhookRequest } = await import("../../messages/WebhookRequest.js");
        const wq = iris.workerQueue(WebhookRequest);
        const msg = wq.create({
          correlationId: ctx.state.metadata.correlationId,
          event,
          payload,
          tenantId: ctx.state.tenant ?? null,
        });
        await wq.publish(msg);
      } catch (err: any) {
        if (optional) {
          ctx.logger.warn("Failed to handle webhook", err);
          return;
        }
        throw err;
      }
    };
    await next();
  };
};

import { Conduit, type ConduitClientCredentialsCache } from "@lindorm/conduit";
import type { ILogger } from "@lindorm/logger";
import { WebhookMethod } from "../../enums/index.js";
import type { IWebhookSubscription } from "../../interfaces/index.js";
import { createConduitWebhookAuthMiddleware } from "../../middleware/index.js";

// `clientSecret` is a proteus `@Encrypted` column: proteus seals it on write and
// decrypts it transparently on read, so the subscription arrives here in the
// clear. Dispatch performs no crypto of its own — the read side that loaded the
// subscription (the webhook request consumer's `repo.find`) already decrypted it.
export const createDispatchWebhook = (
  logger: ILogger,
  cache: ConduitClientCredentialsCache = [],
) => {
  const conduit = new Conduit({ logger });

  return async function dispatchWebhook(dispatch: {
    event: string;
    payload: any;
    subscription: IWebhookSubscription;
  }): Promise<void> {
    const middleware = await createConduitWebhookAuthMiddleware(
      dispatch.subscription,
      cache,
    );

    const method = dispatch.subscription.method ?? WebhookMethod.Post;
    const requestOptions = {
      body: dispatch.payload,
      query: { event: dispatch.event },
      middleware: [middleware],
    };

    switch (method) {
      case WebhookMethod.Put:
        await conduit.put(dispatch.subscription.url, requestOptions);
        break;

      case WebhookMethod.Patch:
        await conduit.patch(dispatch.subscription.url, requestOptions);
        break;

      case WebhookMethod.Post:
      default:
        await conduit.post(dispatch.subscription.url, requestOptions);
        break;
    }
  };
};

import { AesKit } from "@lindorm/aes";
import { Conduit, ConduitClientCredentialsCache } from "@lindorm/conduit";
import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { WebhookMethod } from "../../enums";
import { IWebhookSubscription } from "../../interfaces";
import { createConduitWebhookAuthMiddleware } from "../../middleware";

type Options = {
  encryptionKey?: IKryptos;
};

export const createDispatchWebhook = (
  options: Options,
  logger: ILogger,
  cache: ConduitClientCredentialsCache = [],
) => {
  const aes = options.encryptionKey
    ? new AesKit({ kryptos: options.encryptionKey })
    : undefined;

  const conduit = new Conduit({ logger });

  return async function dispatchWebhook(dispatch: {
    event: string;
    payload: any;
    subscription: IWebhookSubscription;
  }): Promise<void> {
    if (
      aes &&
      dispatch.subscription.clientSecret &&
      AesKit.isAesTokenised(dispatch.subscription.clientSecret)
    ) {
      dispatch.subscription.clientSecret = aes.decrypt<string>(
        dispatch.subscription.clientSecret,
      );
    }

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

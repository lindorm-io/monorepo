import { AesKit } from "@lindorm/aes";
import { Conduit, ConduitClientCredentialsCache } from "@lindorm/conduit";
import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { IWebhookDispatch } from "../../interfaces";
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

  return async function dispatchWebhook(dispatch: IWebhookDispatch): Promise<void> {
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

    await conduit.post(dispatch.subscription.url, {
      body: dispatch.payload,
      query: { event: dispatch.event },
      middleware: [middleware],
    });
  };
};

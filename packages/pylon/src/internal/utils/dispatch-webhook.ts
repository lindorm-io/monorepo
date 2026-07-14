import { Aegis } from "@lindorm/aegis";
import { AesKit } from "@lindorm/aes";
import type { IAmphora } from "@lindorm/amphora";
import { Conduit, type ConduitClientCredentialsCache } from "@lindorm/conduit";
import type { ILogger } from "@lindorm/logger";
import { WebhookMethod } from "../../enums/index.js";
import type { IWebhookSubscription } from "../../interfaces/index.js";
import { createConduitWebhookAuthMiddleware } from "../../middleware/index.js";
import type { PylonEncKey } from "../../types/index.js";

type Options = {
  amphora: IAmphora;
  encryptionKey?: PylonEncKey;
};

export const createDispatchWebhook = (
  options: Options,
  logger: ILogger,
  cache: ConduitClientCredentialsCache = [],
) => {
  // The stored `clientSecret` is a tokenised AES ciphertext, and ciphertext names
  // its own key: `keyId` is in the token. So the read goes through `aegis.aes`,
  // exactly like a stored session's tokens and every other at-rest ciphertext in
  // the toolkit — the key is resolved from the id the ciphertext carries, the
  // decrypt FLOOR (`use: "enc"`, private half, not pending) is applied to whatever
  // that id produced, and an injected `kryptos` is honoured ONLY when it IS the
  // key the ciphertext names.
  //
  // Pylon adds no floor of its own here — aegis owns the encryption floors, as it
  // does for cookie and session encryption (see `internal/constants/key-floor`).
  // What pylon used to do instead was build a raw `AesKit` from
  // `webhook.encryptionKey` and decrypt with it whatever the ciphertext said: an
  // unfloored key, and — worse — a secret sealed by the PREVIOUS key would be
  // decrypted with the CURRENT one, so a single rotation broke every subscription
  // written before it.
  const aegis = new Aegis({ amphora: options.amphora, logger });

  const conduit = new Conduit({ logger });

  return async function dispatchWebhook(dispatch: {
    event: string;
    payload: any;
    subscription: IWebhookSubscription;
  }): Promise<void> {
    if (
      dispatch.subscription.clientSecret &&
      AesKit.isAesTokenised(dispatch.subscription.clientSecret)
    ) {
      dispatch.subscription.clientSecret = await aegis.aes.decrypt<string>(
        dispatch.subscription.clientSecret,
        options.encryptionKey,
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

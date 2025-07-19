import {
  conduitBasicAuthMiddleware,
  ConduitClientCredentialsCache,
  conduitClientCredentialsMiddlewareFactory,
  ConduitError,
  conduitHeadersMiddleware,
  ConduitMiddleware,
} from "@lindorm/conduit";
import { WebhookAuth } from "../../enums";
import { IWebhookSubscription } from "../../interfaces";

const emptyMiddleware: ConduitMiddleware = async (_, next) => {
  await next();
};

export const createConduitWebhookAuthMiddleware = async (
  subscription: IWebhookSubscription,
  cache: ConduitClientCredentialsCache,
): Promise<ConduitMiddleware> => {
  if (subscription.auth === WebhookAuth.None) {
    return emptyMiddleware;
  }

  if (subscription.auth === WebhookAuth.AuthHeaders) {
    if (Object.keys(subscription.authHeaders).length === 0) {
      throw new ConduitError("Webhook subscription is missing auth headers");
    }

    return conduitHeadersMiddleware(subscription.authHeaders);
  }

  if (subscription.auth === WebhookAuth.Basic) {
    if (!subscription.username || !subscription.password) {
      throw new ConduitError("Webhook subscription is missing basic auth credentials");
    }

    return conduitBasicAuthMiddleware(subscription.username, subscription.password);
  }

  if (subscription.auth === WebhookAuth.ClientCredentials) {
    if (!subscription.clientId || !subscription.clientSecret || !subscription.issuer) {
      throw new ConduitError("Webhook subscription is missing client credentials");
    }

    const factory = conduitClientCredentialsMiddlewareFactory(
      {
        authLocation: subscription.authLocation ?? undefined,
        clientId: subscription.clientId,
        clientSecret: subscription.clientSecret,
        contentType: subscription.contentType ?? undefined,
        issuer: subscription.issuer,
        tokenUri: subscription.tokenUri ?? undefined,
      },
      cache,
    );

    return await factory({
      audience: subscription.audience ?? undefined,
      scope: subscription.scope,
    });
  }

  throw new ConduitError("Webhook subscription is missing auth type");
};

import {
  conduitBasicAuthMiddleware,
  type ConduitClientCredentialsCache,
  conduitClientCredentialsMiddlewareFactory,
  conduitHeadersMiddleware,
  type ConduitMiddleware,
} from "@lindorm/conduit";
import { InternalServerError } from "@lindorm/errors";
import { WebhookAuth } from "../../enums/index.js";
import type { IWebhookSubscription } from "../../interfaces/index.js";

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
      throw new InternalServerError("Webhook subscription is missing auth headers");
    }

    return conduitHeadersMiddleware(subscription.authHeaders);
  }

  if (subscription.auth === WebhookAuth.Basic) {
    if (!subscription.username || !subscription.password) {
      throw new InternalServerError(
        "Webhook subscription is missing basic auth credentials",
      );
    }

    return conduitBasicAuthMiddleware(subscription.username, subscription.password);
  }

  if (subscription.auth === WebhookAuth.ClientCredentials) {
    if (!subscription.clientId || !subscription.clientSecret || !subscription.issuer) {
      throw new InternalServerError("Webhook subscription is missing client credentials");
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

  throw new InternalServerError("Webhook subscription is missing auth type");
};

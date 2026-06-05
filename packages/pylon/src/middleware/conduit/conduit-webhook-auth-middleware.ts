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
      throw new InternalServerError("Webhook subscription is missing auth headers", {
        code: "webhook_missing_auth_headers",
        type: "urn:lindorm:pylon:error:webhook_missing_auth_headers",
        details:
          "Webhook auth is set to auth_headers but no authHeaders were configured on the subscription",
        data: { auth: subscription.auth, subscriptionId: subscription.id },
      });
    }

    return conduitHeadersMiddleware(subscription.authHeaders);
  }

  if (subscription.auth === WebhookAuth.Basic) {
    if (!subscription.username || !subscription.password) {
      throw new InternalServerError(
        "Webhook subscription is missing basic auth credentials",
        {
          code: "webhook_missing_basic_credentials",
          type: "urn:lindorm:pylon:error:webhook_missing_basic_credentials",
          details:
            "Webhook auth is set to basic but username and/or password were not configured",
          data: {
            auth: subscription.auth,
            subscriptionId: subscription.id,
            hasUsername: Boolean(subscription.username),
            hasPassword: Boolean(subscription.password),
          },
        },
      );
    }

    return conduitBasicAuthMiddleware(subscription.username, subscription.password);
  }

  if (subscription.auth === WebhookAuth.ClientCredentials) {
    if (!subscription.clientId || !subscription.clientSecret || !subscription.issuer) {
      throw new InternalServerError(
        "Webhook subscription is missing client credentials",
        {
          code: "webhook_missing_client_credentials",
          type: "urn:lindorm:pylon:error:webhook_missing_client_credentials",
          details:
            "Webhook auth is set to client_credentials but clientId, clientSecret and/or issuer were not configured",
          data: {
            auth: subscription.auth,
            subscriptionId: subscription.id,
            hasClientId: Boolean(subscription.clientId),
            hasClientSecret: Boolean(subscription.clientSecret),
            hasIssuer: Boolean(subscription.issuer),
          },
        },
      );
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

  throw new InternalServerError("Webhook subscription has an unknown auth type", {
    code: "webhook_unknown_auth_type",
    type: "urn:lindorm:pylon:error:webhook_unknown_auth_type",
    details: "The webhook subscription auth value did not match any supported strategy",
    data: { auth: subscription.auth, subscriptionId: subscription.id },
  });
};

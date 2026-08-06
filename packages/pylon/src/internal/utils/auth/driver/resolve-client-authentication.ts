import { conduitBasicAuthMiddleware } from "@lindorm/conduit";
import type { ConduitMiddleware } from "@lindorm/conduit";
import { ServerError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { PylonClientAuthMethod } from "../../../../types/index.js";

export type ResolveClientAuthenticationOptions = {
  clientId: string;
  clientSecret?: string;
  method: PylonClientAuthMethod;
};

export type PylonClientAuthentication = {
  /** Parameters to merge into the form body. Snake-cased on the way out. */
  body: Dict;
  /** Middleware carrying the credentials in headers instead. */
  middleware: Array<ConduitMiddleware>;
};

/**
 * Compose the chosen client-authentication method into the parts a request
 * needs — a body fragment, header middleware, or both empty.
 */
export const resolveClientAuthentication = (
  options: ResolveClientAuthenticationOptions,
): PylonClientAuthentication => {
  const { clientId, clientSecret, method } = options;

  switch (method) {
    // OIDC Core §9 / RFC 6749 §2.3.1 — credentials in the Authorization header,
    // never in the form. The secret must not reach a query log.
    case "client_secret_basic":
      if (!isString(clientSecret)) {
        throw new ServerError("Client secret is required for client_secret_basic", {
          code: "client_secret_missing",
          title: "Client Secret Missing",
          type: "urn:lindorm:pylon:error:client_secret_missing",
          details:
            "The driver resolved client_secret_basic but carries no clientSecret. A client without a secret authenticates with the `none` method.",
          data: { clientId, method },
        });
      }

      return {
        body: {},
        middleware: [conduitBasicAuthMiddleware(clientId, clientSecret)],
      };

    // OIDC Core §9 — credentials as form parameters.
    case "client_secret_post":
      if (!isString(clientSecret)) {
        throw new ServerError("Client secret is required for client_secret_post", {
          code: "client_secret_missing",
          title: "Client Secret Missing",
          type: "urn:lindorm:pylon:error:client_secret_missing",
          details:
            "The driver resolved client_secret_post but carries no clientSecret. A client without a secret authenticates with the `none` method.",
          data: { clientId, method },
        });
      }

      return { body: { clientId, clientSecret }, middleware: [] };

    // RFC 7591 §2 `none` — a public client. RFC 6749 §3.2.1 still requires it to
    // identify itself, so `client_id` goes in the body and nothing else.
    case "none":
      return { body: { clientId }, middleware: [] };

    default:
      throw new ServerError("Unknown client authentication method", {
        code: "client_auth_method_unknown",
        title: "Client Auth Method Unknown",
        type: "urn:lindorm:pylon:error:client_auth_method_unknown",
        details:
          "The resolved client authentication method is not one pylon composes; see the method in error data.",
        data: { method },
      });
  }
};

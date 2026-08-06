import { ServerError } from "@lindorm/errors";
import { isArray, isString } from "@lindorm/is";
import type { ILogger } from "@lindorm/logger";
import type { TokenEndpointAuthMethod } from "@lindorm/openid";
import type { PylonClientAuthMethod } from "../../../../types/index.js";

export type ResolveTokenEndpointAuthMethodOptions = {
  clientSecret?: string;
  logger: ILogger;
  /** Pinned by driver settings — skips negotiation entirely. */
  pinned?: TokenEndpointAuthMethod;
  /** wire: `token_endpoint_auth_methods_supported`, when the provider advertises it. */
  supported?: Array<TokenEndpointAuthMethod | (string & {})>;
};

/**
 * OIDC Discovery §3 / RFC 8414 §2 — `token_endpoint_auth_methods_supported` is
 * OPTIONAL, and when it is omitted the spec default is `client_secret_basic`.
 */
const DEFAULT_METHOD: PylonClientAuthMethod = "client_secret_basic";

const isComposable = (method: string): method is PylonClientAuthMethod =>
  method === "client_secret_basic" ||
  method === "client_secret_post" ||
  method === "none";

/**
 * Pick ONE client-authentication method. RFC 6749 §2.3 lets a client use at most
 * one per request, so this returns a single value rather than composing every
 * method the provider happens to advertise.
 */
export const resolveTokenEndpointAuthMethod = (
  options: ResolveTokenEndpointAuthMethodOptions,
): PylonClientAuthMethod => {
  const { clientSecret, logger, pinned, supported } = options;

  // Gap 2 — a public client has no secret to present, so `none` is the only
  // truthful answer regardless of what the provider advertises or the operator
  // pinned. RFC 6749 §3.2.1 still requires `client_id` in the request; that is
  // what `none` composes.
  if (!isString(clientSecret)) {
    logger.debug("Client has no secret, authenticating with client_id only", {
      method: "none",
      pinned,
    });
    return "none";
  }

  if (isString(pinned)) {
    if (isComposable(pinned)) return pinned;

    throw new ServerError("Token endpoint auth method is not supported", {
      code: "token_endpoint_auth_method_not_supported",
      title: "Token Endpoint Auth Method Not Supported",
      type: "urn:lindorm:pylon:error:token_endpoint_auth_method_not_supported",
      status: ServerError.Status.NotImplemented,
      details:
        "The driver pins a client authentication method pylon does not compose. Only client_secret_basic, client_secret_post and none are built in; a method needing a signing key or a client certificate must be attached as conduit middleware by the driver itself.",
      data: { tokenEndpointAuthMethod: pinned },
    });
  }

  if (!isArray(supported)) return DEFAULT_METHOD;

  if (supported.includes("client_secret_basic")) return "client_secret_basic";
  if (supported.includes("client_secret_post")) return "client_secret_post";

  // The provider advertises only methods pylon cannot compose. Falling back to
  // the spec default at least sends credentials the provider may still accept —
  // and says so, because the request may well be rejected.
  logger.warn("IdP advertises no client authentication method pylon can compose", {
    fallback: DEFAULT_METHOD,
    supported,
  });

  return DEFAULT_METHOD;
};

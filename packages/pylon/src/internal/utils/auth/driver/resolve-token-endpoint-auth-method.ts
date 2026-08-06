import type { AegisSignKey } from "@lindorm/aegis";
import { ServerError } from "@lindorm/errors";
import { isArray, isObject, isString } from "@lindorm/is";
import type { ILogger } from "@lindorm/logger";
import type { TokenEndpointAuthMethod } from "@lindorm/openid";
import type { PylonClientAuthMethod } from "../../../../types/index.js";

export type ResolveTokenEndpointAuthMethodOptions = {
  /** The driver's `clientAssertion.key` — `null` when it carries none. */
  assertionKey?: AegisSignKey | null;
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

/** Narrows the wider IANA-registry union to the methods pylon spells at all. */
const isPylonClientAuthMethod = (method: string): method is PylonClientAuthMethod =>
  method === "client_secret_basic" ||
  method === "client_secret_jwt" ||
  method === "client_secret_post" ||
  method === "none" ||
  method === "private_key_jwt";

/**
 * The methods this driver can actually compose, STRONGEST FIRST — which is also
 * the negotiation order. A method is listed only when the credential it needs
 * is present, so capability comes from the driver's own configuration and
 * negotiation can never pick something that would throw at compose time.
 *
 * The ordering is by what a compromise costs, not by convenience:
 *
 * 1. `private_key_jwt` — asymmetric proof. The provider stores only the PUBLIC
 *    half, so a breach of ITS store yields nothing that can impersonate this
 *    client. No other method has that property; it outranks everything.
 * 2. `client_secret_jwt` — a shared secret, but the secret itself never crosses
 *    the wire: only a MAC over an assertion that is short-lived (`exp`) and
 *    single-use (`jti`, OIDC Core §9). A captured request cannot be replayed as
 *    credentials, which is exactly what the two below cannot say.
 * 3. `client_secret_basic` — the secret in cleartext, in the `Authorization`
 *    header. Above `post` because that header is what every proxy, log
 *    scrubber and APM agent already knows to redact.
 * 4. `client_secret_post` — the secret in cleartext, in the form body, where
 *    nothing redacts it by default.
 *
 * `none` is absent by construction: it is not a stronger or weaker choice among
 * credentials, it is what is left when there are none, and it is returned
 * directly below.
 */
const composableMethods = (
  assertionKey: AegisSignKey | null | undefined,
  clientSecret: string | undefined,
): Array<PylonClientAuthMethod> => [
  ...(isObject(assertionKey) ? (["private_key_jwt"] as const) : []),
  ...(isString(clientSecret)
    ? (["client_secret_jwt", "client_secret_basic", "client_secret_post"] as const)
    : []),
];

/**
 * Pick ONE client-authentication method. RFC 6749 §2.3 lets a client use at most
 * one per request, so this returns a single value rather than composing every
 * method the provider happens to advertise.
 */
export const resolveTokenEndpointAuthMethod = (
  options: ResolveTokenEndpointAuthMethodOptions,
): PylonClientAuthMethod => {
  const { assertionKey, clientSecret, logger, pinned, supported } = options;

  const composable = composableMethods(assertionKey, clientSecret);

  // Gap 2 — a client holding NEITHER a secret NOR an assertion key has nothing
  // to present, so `none` is the only truthful answer regardless of what the
  // provider advertises or the operator pinned. RFC 6749 §3.2.1 still requires
  // `client_id` in the request; that is what `none` composes.
  if (!composable.length) {
    logger.debug("Client has no credentials, authenticating with client_id only", {
      method: "none",
      pinned,
    });
    return "none";
  }

  // The spec default when the provider advertises nothing — unless this driver
  // cannot compose it, in which case the strongest thing it CAN compose is the
  // only honest fallback (a key-only client with no secret is the real case).
  const fallback = composable.includes(DEFAULT_METHOD) ? DEFAULT_METHOD : composable[0];

  if (isString(pinned)) {
    // `none` is pinnable even by a client that HAS credentials — an operator
    // may legitimately choose not to present them — so it bypasses the
    // credential check the other four go through.
    if (
      isPylonClientAuthMethod(pinned) &&
      (pinned === "none" || composable.includes(pinned))
    ) {
      return pinned;
    }

    throw new ServerError("Token endpoint auth method is not supported", {
      code: "token_endpoint_auth_method_not_supported",
      title: "Token Endpoint Auth Method Not Supported",
      type: "urn:lindorm:pylon:error:token_endpoint_auth_method_not_supported",
      status: ServerError.Status.NotImplemented,
      details:
        "The driver pins a client authentication method it cannot compose. The RFC 8705 mTLS methods are not built in at all — they prove a client certificate during the TLS handshake, so a driver wanting one attaches its own conduit middleware. The other methods are composable but need a credential this driver does not carry: private_key_jwt needs clientAssertion.key, and everything else needs clientSecret.",
      data: { composable, tokenEndpointAuthMethod: pinned },
    });
  }

  if (!isArray(supported)) return fallback;

  const negotiated = composable.find((method) => supported.includes(method));

  if (isString(negotiated)) return negotiated;

  // The provider advertises only methods this driver cannot compose. Falling
  // back at least sends credentials the provider may still accept — and says
  // so, because the request may well be rejected.
  logger.warn("IdP advertises no client authentication method pylon can compose", {
    composable,
    fallback,
    supported,
  });

  return fallback;
};

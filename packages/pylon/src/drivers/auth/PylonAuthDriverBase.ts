import { conduitChangeResponseDataMiddleware } from "@lindorm/conduit";
import { sec } from "@lindorm/date";
import { ServerError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import type { AuthorizeRequestQuery } from "@lindorm/openid";
import type { Dict } from "@lindorm/types";
import { createUrl } from "@lindorm/url";
import { merge, sortKeys } from "@lindorm/utils";
import type { IPylonAuthDriver } from "../../interfaces/index.js";
import {
  resolveClientAuthentication,
  resolveTokenEndpointAuthMethod,
} from "../../internal/utils/auth/driver/index.js";
import type {
  PylonAuthAuthorizeOptions,
  PylonAuthClientCredentialsOptions,
  PylonAuthDriverAuthorizeSettings,
  PylonAuthDriverClientAssertionSettings,
  PylonAuthDriverContext,
  PylonAuthDriverSettings,
  PylonAuthEndpoints,
  PylonAuthExchangeOptions,
  PylonAuthIssuerScope,
  PylonAuthRefreshOptions,
  PylonAuthTokenRequest,
  PylonAuthTokenResult,
  PylonClientAuthMethod,
} from "../../types/index.js";

/**
 * The OAuth2 mechanics every provider shares, with `endpoints()` as its ONE
 * abstract member. Extend it for a provider that publishes no discovery
 * document — return the endpoints as a literal and everything else works.
 *
 * ⚠ `endpoints()` is SYNCHRONOUS (see {@link IPylonAuthDriver}): amphora does
 * every fetch at its own setup, so a subclass needing foreign keys registers
 * that issuer with `amphora.external` rather than fetching here. It is also
 * where a subclass says its provider has NO authorization or token endpoint —
 * `null` for either, and the relying-party methods below fail by name instead
 * of requesting nothing.
 *
 * It deliberately implements only the RELYING PARTY grants. `introspect`,
 * `userinfo`, `subject` and `logout` are left off: a subclass that can serve
 * them declares them, and one that cannot stays silent, which is what makes
 * pylon's boot validation possible.
 */
export abstract class PylonAuthDriverBase implements IPylonAuthDriver {
  readonly clientId: string;
  readonly pkce: PylonAuthDriverSettings["pkce"];

  /**
   * `"none"` — a subclass returning its endpoints as a LITERAL resolves its own
   * issuer and pins neither of amphora's own-side scopes. That is the shape this
   * base exists for, so it is the default; a subclass reading `amphora.idp` or
   * `amphora.internal` overrides it and gets the boot check that goes with it.
   */
  readonly issuerScope: PylonAuthIssuerScope = "none";

  protected readonly authorizeSettings: PylonAuthDriverAuthorizeSettings;
  protected readonly clientAssertionSettings: PylonAuthDriverClientAssertionSettings;
  protected readonly clientSecret?: string;
  protected readonly pinnedTokenEndpointAuthMethod: PylonAuthDriverSettings["tokenEndpointAuthMethod"];

  constructor(settings: PylonAuthDriverSettings) {
    this.clientId = settings.clientId;
    this.clientSecret = settings.clientSecret;
    this.pinnedTokenEndpointAuthMethod = settings.tokenEndpointAuthMethod;

    this.clientAssertionSettings = {
      // OIDC Core §9 has an assertion used ONCE; a minute is the interoperable
      // ceiling providers assume and enough to absorb ordinary clock skew.
      expiry: settings.clientAssertion?.expiry ?? "1 minute",
      key: settings.clientAssertion?.key ?? null,
    };

    // `undefined` means "not configured" and takes the default; `null` is the
    // operator saying this provider rejects PKCE. `??` cannot tell them apart.
    this.pkce = settings.pkce === undefined ? "S256" : settings.pkce;

    this.authorizeSettings = {
      acrValues: settings.authorize?.acrValues ?? null,
      maxAge: settings.authorize?.maxAge ?? null,
      prompt: settings.authorize?.prompt ?? null,
      resource: settings.authorize?.resource ?? null,
      responseType: settings.authorize?.responseType ?? "code",
      scope: settings.authorize?.scope ?? ["openid"],
    };
  }

  abstract endpoints(context: PylonAuthDriverContext): PylonAuthEndpoints;

  // --- IPylonAuthDriver ---

  async authorize(
    context: PylonAuthDriverContext,
    options: PylonAuthAuthorizeOptions,
  ): Promise<URL> {
    const endpoints = this.endpoints(context);

    // `authorization_endpoint` is `string | null` on the surface because a
    // VERIFY-ONLY driver has none. This base is the relying party, so reaching
    // here without one means the deployment mounted a login against a provider
    // that cannot serve it — fail by name rather than redirecting to `null`.
    if (!isString(endpoints.authorizationEndpoint)) {
      throw new ServerError("IdP does not publish an authorization endpoint", {
        code: "idp_authorization_endpoint_not_supported",
        title: "IdP Authorization Endpoint Not Supported",
        type: "urn:lindorm:pylon:error:idp_authorization_endpoint_not_supported",
        status: ServerError.Status.NotImplemented,
        details:
          "The driver resolved no `authorization_endpoint` (RFC 6749 §3.1), so no login can be started against this provider. Configure a provider that publishes one, or drop `auth.router` for a service that only validates tokens.",
        data: { issuer: endpoints.issuer },
      });
    }

    // Sorted AFTER the subclass hook so a renamed parameter still lands in
    // order — the Auth0 `resource` ⇒ `audience` swap is exactly that.
    return createUrl(endpoints.authorizationEndpoint, {
      query: sortKeys(this.authorizeQuery(options)),
      changeQueryCase: "snake",
    });
  }

  async exchange(
    context: PylonAuthDriverContext,
    options: PylonAuthExchangeOptions,
  ): Promise<PylonAuthTokenResult> {
    return this.tokenRequest(context, {
      code: options.code,
      grantType: "authorization_code",
      redirectUri: options.redirectUri,
      ...(isString(options.codeVerifier) && { codeVerifier: options.codeVerifier }),
      ...(isString(options.scope) && { scope: options.scope }),
    });
  }

  async refresh(
    context: PylonAuthDriverContext,
    options: PylonAuthRefreshOptions,
  ): Promise<PylonAuthTokenResult> {
    return this.tokenRequest(context, {
      grantType: "refresh_token",
      refreshToken: options.refreshToken,
      ...(isString(options.scope) && { scope: options.scope }),
    });
  }

  async clientCredentials(
    context: PylonAuthDriverContext,
    options: PylonAuthClientCredentialsOptions,
  ): Promise<PylonAuthTokenResult> {
    return this.tokenRequest(context, {
      grantType: "client_credentials",
      ...(isString(options.resource) && { resource: options.resource }),
      ...(isString(options.scope) && { scope: options.scope }),
    });
  }

  // --- Subclass hooks ---

  /**
   * The authorization request as camelCase parameter names, before sorting and
   * snake-casing. THE vendor seam: a provider that renames a parameter overrides
   * this one method and changes nothing else.
   */
  protected authorizeQuery(options: PylonAuthAuthorizeOptions): Dict {
    const { acrValues, maxAge, prompt, resource, responseType, scope } =
      this.authorizeSettings;
    const { codeChallenge, codeChallengeMethod, nonce, query, redirectUri, state } =
      options;

    // PKCE (RFC 7636) protects the code exchange; a response type that returns
    // no code has nothing to protect.
    const code = responseType.includes("code");

    const authorize: AuthorizeRequestQuery = {
      clientId: this.clientId,
      nonce,
      redirectUri,
      responseType,
      scope: scope.join(" "),
      state,
      ...(acrValues && { acrValues }),
      ...(resource && { resource }),
      ...(code &&
        isString(codeChallenge) &&
        isString(codeChallengeMethod) && { codeChallenge, codeChallengeMethod }),
      ...(maxAge && { maxAge: sec(maxAge).toString() }),
      ...(prompt && { prompt }),
    };

    return merge<Dict>(authorize, query ?? {});
  }

  /**
   * Which client-authentication method to use. The base has only its settings to
   * go on; a discovery-backed subclass overrides this to negotiate from
   * `token_endpoint_auth_methods_supported`.
   */
  protected tokenEndpointAuthMethod(
    context: PylonAuthDriverContext,
  ): PylonClientAuthMethod {
    return resolveTokenEndpointAuthMethod({
      assertionKey: this.clientAssertionSettings.key,
      clientSecret: this.clientSecret,
      logger: context.logger,
      pinned: this.pinnedTokenEndpointAuthMethod,
    });
  }

  /**
   * The `aud` of an RFC 7523 §2.2 client assertion. OIDC Core §9 says it SHOULD
   * be the token endpoint URL, which is what every provider following that
   * document expects — but RFC 7523 §3 only requires "a value that identifies
   * the authorization server", so a provider that wants its ISSUER identifier
   * instead overrides this and changes nothing else.
   *
   * ⚠ The parameter narrows `tokenEndpoint` to a non-null `string`: the only
   * caller has already asserted it, and a driver that reached a token request
   * without one failed earlier by name.
   */
  protected clientAssertionAudience(
    endpoints: PylonAuthEndpoints & { tokenEndpoint: string },
  ): string {
    return endpoints.tokenEndpoint;
  }

  /**
   * POST a grant to the token endpoint.
   *
   * ⚠ `application/x-www-form-urlencoded`, never JSON — RFC 6749 §4.1.3 requires
   * it. Auth0 tolerates JSON, which is how sending it went unnoticed; Discord
   * and others reject it outright. Snake-casing happens in the conduit's request
   * middleware, which conduit runs BEFORE it encodes.
   */
  protected async tokenRequest(
    context: PylonAuthDriverContext,
    request: PylonAuthTokenRequest,
  ): Promise<PylonAuthTokenResult> {
    const endpoints = this.endpoints(context);

    // Every grant this base runs POSTs to the token endpoint, so a provider
    // without one supports none of them. RFC 6749 §3.2 makes it REQUIRED for
    // any grant; `null` here is a VERIFY-ONLY surface reaching relying-party
    // code, which is a configuration error and not a request to retry.
    if (!isString(endpoints.tokenEndpoint)) {
      throw new ServerError("IdP does not publish a token endpoint", {
        code: "idp_token_endpoint_not_supported",
        title: "IdP Token Endpoint Not Supported",
        type: "urn:lindorm:pylon:error:idp_token_endpoint_not_supported",
        status: ServerError.Status.NotImplemented,
        details:
          "The driver resolved no `token_endpoint` (RFC 6749 §3.2), so no OAuth2 grant can be run against this provider. A driver that only verifies tokens has no token endpoint by design and must not be configured as a relying party.",
        data: { issuer: endpoints.issuer },
      });
    }

    const auth = await resolveClientAuthentication(context, {
      assertion: this.clientAssertionSettings,
      audience: this.clientAssertionAudience({
        ...endpoints,
        tokenEndpoint: endpoints.tokenEndpoint,
      }),
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      method: this.tokenEndpointAuthMethod(context),
    });

    const { data } = await context.conduit.post<PylonAuthTokenResult>(
      endpoints.tokenEndpoint,
      {
        body: sortKeys({ ...auth.body, ...request }),
        contentType: "application/x-www-form-urlencoded",
        middleware: [
          ...auth.middleware,
          // Depth 1 — RFC 9396 §2 `authorization_details` entries carry fields
          // defined by the schema named in `type`, which MAY already be
          // camelCase; converting them rewrites someone else's schema.
          conduitChangeResponseDataMiddleware("camel", { depth: 1 }),
        ],
      },
    );

    return data;
  }
}

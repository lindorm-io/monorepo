import { conduitChangeResponseDataMiddleware } from "@lindorm/conduit";
import { sec } from "@lindorm/date";
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
  PylonAuthDriverContext,
  PylonAuthDriverSettings,
  PylonAuthEndpoints,
  PylonAuthExchangeOptions,
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
 * It deliberately implements only the RELYING PARTY grants. `introspect`,
 * `userinfo`, `subject` and `logout` are left off: a subclass that can serve
 * them declares them, and one that cannot stays silent, which is what makes
 * pylon's boot validation possible.
 */
export abstract class PylonAuthDriverBase implements IPylonAuthDriver {
  readonly pkce: PylonAuthDriverSettings["pkce"];

  protected readonly authorizeSettings: PylonAuthDriverAuthorizeSettings;
  protected readonly clientId: string;
  protected readonly clientSecret?: string;
  protected readonly pinnedTokenEndpointAuthMethod: PylonAuthDriverSettings["tokenEndpointAuthMethod"];

  constructor(settings: PylonAuthDriverSettings) {
    this.clientId = settings.clientId;
    this.clientSecret = settings.clientSecret;
    this.pinnedTokenEndpointAuthMethod = settings.tokenEndpointAuthMethod;

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

  abstract endpoints(context: PylonAuthDriverContext): Promise<PylonAuthEndpoints>;

  // --- IPylonAuthDriver ---

  async authorize(
    context: PylonAuthDriverContext,
    options: PylonAuthAuthorizeOptions,
  ): Promise<URL> {
    const endpoints = await this.endpoints(context);

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
      clientSecret: this.clientSecret,
      logger: context.logger,
      pinned: this.pinnedTokenEndpointAuthMethod,
    });
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
    const endpoints = await this.endpoints(context);

    const auth = resolveClientAuthentication({
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

import { isString } from "@lindorm/is";
import type { LogoutRequest } from "@lindorm/openid";
import type { Dict } from "@lindorm/types";
import { createUrl } from "@lindorm/url";
import { merge, sortKeys } from "@lindorm/utils";
import {
  fetchIntrospection,
  fetchUserinfo,
  openIdEndpoints,
  resolveSubject,
  resolveTokenEndpointAuthMethod,
} from "../../internal/utils/auth/driver/index.js";
import { getOpenIdConfiguration } from "../../internal/utils/auth/get-open-id-configuration.js";
import type {
  PylonAuthDriverContext,
  PylonAuthEndpoints,
  PylonAuthIntrospectOptions,
  PylonAuthIssuerScope,
  PylonAuthLogoutOptions,
  PylonAuthLogoutResult,
  PylonAuthSubjectOptions,
  PylonAuthUserinfoOptions,
  PylonClientAuthMethod,
  PylonIntrospection,
  PylonUserinfo,
} from "../../types/index.js";
import { PylonAuthDriverBase } from "./PylonAuthDriverBase.js";

/**
 * The discovery-backed driver — usable as-is against any OpenID Provider that
 * publishes `.well-known/openid-configuration`. Covers tyr, Auth0 and Google.
 *
 * It implements EVERY method on the contract, so pylon's boot validation passes
 * whatever the deployment configures.
 *
 * ⚠ It declares NO issuer. Its provider is whatever is registered on
 * `amphora.idp` — the registration that fetched the discovery document and the
 * provider's keys. Picking this driver IS the declaration that the upstream idp
 * is the party this deployment talks to.
 */
export class OpenIdDriver extends PylonAuthDriverBase {
  /**
   * Picking this driver IS the declaration that the upstream is the party this
   * deployment talks to — stated here so pylon refuses to boot when no upstream
   * is registered, rather than 500ing every request that reaches the provider.
   * It is not only `endpoints()` that reads the idp: the negotiated auth methods
   * come off the same discovery document.
   */
  override readonly issuerScope: PylonAuthIssuerScope = "idp";

  endpoints(context: PylonAuthDriverContext): PylonAuthEndpoints {
    return openIdEndpoints(context);
  }

  async introspect(
    context: PylonAuthDriverContext,
    options: PylonAuthIntrospectOptions,
  ): Promise<PylonIntrospection> {
    return fetchIntrospection(context, {
      assertion: this.clientAssertionSettings,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      endpoints: this.endpoints(context),
      method: this.introspectionEndpointAuthMethod(context),
      token: options.token,
      ...(isString(options.tokenTypeHint) && { tokenTypeHint: options.tokenTypeHint }),
    });
  }

  async userinfo(
    context: PylonAuthDriverContext,
    options: PylonAuthUserinfoOptions,
  ): Promise<PylonUserinfo> {
    return fetchUserinfo(context, {
      accessToken: options.accessToken,
      endpoints: this.endpoints(context),
    });
  }

  async subject(
    context: PylonAuthDriverContext,
    options: PylonAuthSubjectOptions,
  ): Promise<string | null> {
    return resolveSubject(context, {
      accessToken: options.accessToken,
      endpoints: this.endpoints(context),
    });
  }

  async logout(
    context: PylonAuthDriverContext,
    options: PylonAuthLogoutOptions,
  ): Promise<PylonAuthLogoutResult> {
    const endpoints = this.endpoints(context);

    // `end_session_endpoint` is OPTIONAL (OIDC RP-Initiated Logout 1.0 §2). A
    // provider that omits it has no RP-initiated logout to redirect to — which
    // is a fact to report, not a failure: pylon drops the local session and the
    // user is logged out here.
    if (!isString(endpoints.endSessionEndpoint)) {
      context.logger.debug("IdP publishes no end session endpoint, logging out locally", {
        issuer: endpoints.issuer,
      });

      return { action: "local" };
    }

    const request: LogoutRequest = {
      clientId: this.clientId,
      postLogoutRedirectUri: options.postLogoutRedirectUri,
      state: options.state,
      ...(isString(options.idTokenHint) && { idTokenHint: options.idTokenHint }),
    };

    return {
      action: "redirect",
      url: createUrl(endpoints.endSessionEndpoint, {
        query: sortKeys(merge<Dict>(request, options.query ?? {})),
        changeQueryCase: "snake",
      }),
    };
  }

  /**
   * Negotiate from the provider's own metadata. Absent
   * `token_endpoint_auth_methods_supported` means the spec default
   * (`client_secret_basic`), so a provider that advertises nothing still gets
   * the credentials it is entitled to expect.
   */
  protected override tokenEndpointAuthMethod(
    context: PylonAuthDriverContext,
  ): PylonClientAuthMethod {
    return resolveTokenEndpointAuthMethod({
      assertionKey: this.clientAssertionSettings.key,
      clientSecret: this.clientSecret,
      logger: context.logger,
      pinned: this.pinnedTokenEndpointAuthMethod,
      supported: getOpenIdConfiguration(context).tokenEndpointAuthMethodsSupported,
    });
  }

  /**
   * RFC 8414 §2 gives the introspection endpoint its own
   * `introspection_endpoint_auth_methods_supported`, and a provider may advertise
   * a different set there than at the token endpoint. Negotiating introspection
   * from the token endpoint's list would present a method the provider never
   * offered for that endpoint. A provider publishing no introspection-specific
   * list authenticates it like the token endpoint, which is the documented
   * fallback and what this resolves to.
   */
  protected introspectionEndpointAuthMethod(
    context: PylonAuthDriverContext,
  ): PylonClientAuthMethod {
    const openid = getOpenIdConfiguration(context);

    return resolveTokenEndpointAuthMethod({
      assertionKey: this.clientAssertionSettings.key,
      clientSecret: this.clientSecret,
      logger: context.logger,
      pinned: this.pinnedTokenEndpointAuthMethod,
      supported:
        openid.introspectionEndpointAuthMethodsSupported ??
        openid.tokenEndpointAuthMethodsSupported,
    });
  }
}

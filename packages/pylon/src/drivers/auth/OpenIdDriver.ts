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
  PylonAuthLogoutOptions,
  PylonAuthLogoutResult,
  PylonAuthSubjectOptions,
  PylonAuthUserinfoOptions,
  PylonClientAuthMethod,
  PylonIntrospection,
  PylonOpenIdDriverSettings,
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
 * The discovery document comes from `amphora.idp`, which fetched and caches it
 * alongside the provider's keys — this driver never fetches it itself.
 */
export class OpenIdDriver extends PylonAuthDriverBase {
  protected readonly issuer: string;

  constructor(settings: PylonOpenIdDriverSettings) {
    super(settings);

    this.issuer = settings.issuer;
  }

  async endpoints(context: PylonAuthDriverContext): Promise<PylonAuthEndpoints> {
    return openIdEndpoints(context, this.issuer);
  }

  async introspect(
    context: PylonAuthDriverContext,
    options: PylonAuthIntrospectOptions,
  ): Promise<PylonIntrospection> {
    return fetchIntrospection(context, {
      assertion: this.clientAssertionSettings,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      endpoints: await this.endpoints(context),
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
      endpoints: await this.endpoints(context),
    });
  }

  async subject(
    context: PylonAuthDriverContext,
    options: PylonAuthSubjectOptions,
  ): Promise<string | null> {
    return resolveSubject(context, {
      accessToken: options.accessToken,
      endpoints: await this.endpoints(context),
    });
  }

  async logout(
    context: PylonAuthDriverContext,
    options: PylonAuthLogoutOptions,
  ): Promise<PylonAuthLogoutResult> {
    const endpoints = await this.endpoints(context);

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
      supported: getOpenIdConfiguration(context, { issuer: this.issuer })
        .tokenEndpointAuthMethodsSupported,
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
    const openid = getOpenIdConfiguration(context, { issuer: this.issuer });

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

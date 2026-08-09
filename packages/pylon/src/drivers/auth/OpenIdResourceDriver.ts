import { isString } from "@lindorm/is";
import type { IPylonAuthDriver } from "../../interfaces/index.js";
import {
  fetchIntrospection,
  fetchUserinfo,
  openIdEndpoints,
  resolveSubject,
  resolveTokenEndpointAuthMethod,
} from "../../internal/utils/auth/driver/index.js";
import { getOpenIdConfiguration } from "../../internal/utils/auth/get-open-id-configuration.js";
import type {
  PylonAuthDriverClientAssertionSettings,
  PylonAuthDriverContext,
  PylonAuthEndpoints,
  PylonAuthIntrospectOptions,
  PylonAuthIssuerScope,
  PylonAuthSubjectOptions,
  PylonAuthUserinfoOptions,
  PylonClientAuthMethod,
  PylonIntrospection,
  PylonOpenIdResourceDriverSettings,
  PylonUserinfo,
} from "../../types/index.js";

/**
 * The API-service driver: it validates tokens presented TO this service and
 * never logs anyone in.
 *
 * ⚠ `authorize`, `exchange`, `refresh`, `clientCredentials` and `logout` are
 * genuinely ABSENT — not stubs that throw. `driver.authorize === undefined` is
 * what lets pylon refuse at boot to mount an auth router this driver cannot
 * serve, instead of returning a 500 on the first user request. That is also why
 * this does NOT extend {@link PylonAuthDriverBase}: inheriting the relying-party
 * grants would put them back on the object.
 *
 * The shared work lives in the same helpers `OpenIdDriver` calls, so the two can
 * never disagree about where the provider is or how to authenticate to it — its
 * provider is `amphora.idp`, and it declares no issuer of its own.
 *
 * ⚠ It needs a DISCOVERY DOCUMENT: it reads the introspection and userinfo
 * endpoints off one, and RFC 8414 §2's advertised auth methods to authenticate
 * with. An upstream registered on amphora by `jwksUri` alone publishes none, so
 * this driver cannot serve it — that is what `JwtDriver` is for.
 */
export class OpenIdResourceDriver implements IPylonAuthDriver {
  readonly clientId: string;

  /**
   * Its provider is `amphora.idp`, same as every other discovery-backed driver
   * — so a deployment that registered no upstream is one this driver cannot
   * serve a single request for, and pylon says so at boot.
   */
  readonly issuerScope: PylonAuthIssuerScope = "idp";

  private readonly clientAssertionSettings: PylonAuthDriverClientAssertionSettings;
  private readonly clientSecret?: string;
  private readonly pinnedTokenEndpointAuthMethod: PylonOpenIdResourceDriverSettings["tokenEndpointAuthMethod"];

  constructor(settings: PylonOpenIdResourceDriverSettings) {
    this.clientId = settings.clientId;
    this.clientSecret = settings.clientSecret;
    this.pinnedTokenEndpointAuthMethod = settings.tokenEndpointAuthMethod;

    this.clientAssertionSettings = {
      expiry: settings.clientAssertion?.expiry ?? "1 minute",
      key: settings.clientAssertion?.key ?? null,
    };
  }

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
      method: this.tokenEndpointAuthMethod(context),
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

  /**
   * ⚠ RFC 7662 §2.1 has the RESOURCE SERVER authenticate to the introspection
   * endpoint, and its credentials may legitimately differ from a relying
   * party's — which is exactly why this driver carries its own.
   */
  private tokenEndpointAuthMethod(
    context: PylonAuthDriverContext,
  ): PylonClientAuthMethod {
    const openid = getOpenIdConfiguration(context);

    return resolveTokenEndpointAuthMethod({
      assertionKey: this.clientAssertionSettings.key,
      clientSecret: this.clientSecret,
      logger: context.logger,
      pinned: this.pinnedTokenEndpointAuthMethod,
      // RFC 8414 §2 gives the introspection endpoint its own methods list; a
      // provider that publishes none authenticates it like the token endpoint.
      supported:
        openid.introspectionEndpointAuthMethodsSupported ??
        openid.tokenEndpointAuthMethodsSupported,
    });
  }
}

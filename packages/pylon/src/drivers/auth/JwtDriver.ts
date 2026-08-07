import { ServerError } from "@lindorm/errors";
import type { IPylonAuthDriver } from "../../interfaces/index.js";
import {
  resolveIdpIssuer,
  resolveSelfIssuer,
} from "../../internal/utils/auth/driver/index.js";
import type {
  PylonAuthDriverContext,
  PylonAuthEndpoints,
  PylonJwtDriverIssuer,
  PylonJwtDriverSettings,
} from "../../types/index.js";

/**
 * The verify-only driver: it pins an issuer and does nothing else. No network,
 * ever — not at construction, not per request.
 *
 * Two deployments need it, and neither has an OAuth relationship to describe:
 *
 * - **A service that mints its own tokens.** An OIDC provider verifying what it
 *   issued is its own issuer; there is no upstream to authorize against, and
 *   `new JwtDriver({ issuer: "self" })` says exactly that.
 * - **A resource server pinning an upstream that publishes no discovery
 *   document.** `AmphoraExternalSettings` has `issuer` and `jwksUri` both
 *   optional, so an idp CAN be registered by an issuer + jwksUri pair with no
 *   `.well-known/openid-configuration` behind it. `OpenIdResourceDriver` cannot
 *   serve that — `getOpenIdConfiguration` throws without a document — and this
 *   can, because it needs nothing from one.
 *
 * ⚠ `authorize`, `exchange`, `refresh`, `clientCredentials`, `introspect`,
 * `userinfo`, `subject` and `logout` are genuinely ABSENT, not stubs that throw,
 * and `clientId` is absent too. `driver.authorize === undefined` is what lets
 * pylon refuse at boot to mount an auth router this driver cannot serve, instead
 * of returning a 500 on the first user request. That is also why this does NOT
 * extend `PylonAuthDriverBase`: inheriting the relying-party grants would put
 * them back on the object.
 *
 * ⚠ Which scope it pins is REQUIRED and has no default: a service can federate,
 * holding its OWN issuer AND an upstream at the same time, so "which one do
 * these tokens come from" is not derivable — it is always stated.
 */
export class JwtDriver implements IPylonAuthDriver {
  private readonly scope: PylonJwtDriverIssuer;

  constructor(settings: PylonJwtDriverSettings) {
    // The scope routinely arrives from a config file or an env var, where the
    // literal union buys nothing. Rejecting it HERE means a typo fails the
    // process at construction; letting it through would leave the switch below
    // with no branch and pin `undefined` as the issuer.
    if (settings.issuer !== "self" && settings.issuer !== "idp") {
      throw new ServerError("Unknown JwtDriver issuer scope", {
        code: "jwt_driver_issuer_scope_unknown",
        title: "JwtDriver Issuer Scope Unknown",
        type: "urn:lindorm:pylon:error:jwt_driver_issuer_scope_unknown",
        details:
          'JwtDriver pins one of amphora\'s two own-side issuer scopes: "self" (this service, `amphora.internal`) or "idp" (the registered upstream). See the value received in error data.',
        data: { issuer: settings.issuer },
      });
    }

    this.scope = settings.issuer;
  }

  /**
   * The pinned issuer, and `null` for every endpoint — the driver STATING that
   * this provider has none, which is a fact and not a gap.
   *
   * It throws when the named scope resolves to no issuer: `"self"` with no
   * amphora `issuer` configured, `"idp"` with no idp registered (amphora's own
   * `idp_not_configured`), or `"idp"` registered but with its issuer still
   * unresolved (amphora's `idp_issuer_unresolved`). A pinned issuer that resolves
   * to nothing would verify every token against nothing.
   */
  endpoints(context: PylonAuthDriverContext): PylonAuthEndpoints {
    return {
      issuer: this.issuer(context),
      authorizationEndpoint: null,
      tokenEndpoint: null,
      userinfoEndpoint: null,
      introspectionEndpoint: null,
      revocationEndpoint: null,
      endSessionEndpoint: null,
    };
  }

  private issuer(context: PylonAuthDriverContext): string {
    switch (this.scope) {
      case "self":
        return resolveSelfIssuer(context);

      case "idp":
        return resolveIdpIssuer(context);
    }
  }
}

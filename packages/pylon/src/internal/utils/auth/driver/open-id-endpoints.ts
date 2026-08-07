import type { IAmphora } from "@lindorm/amphora";
import { isString } from "@lindorm/is";
import type { OpenIdConfiguration } from "@lindorm/openid";
import type { PylonAuthEndpoints } from "../../../../types/index.js";
import { getOpenIdConfiguration } from "../get-open-id-configuration.js";
import { resolveIdpIssuer } from "./resolve-amphora-issuer.js";

/**
 * Project a discovery document onto the driver endpoint surface.
 *
 * ⚠ The ISSUER is amphora's, not the document's. Amphora already resolved it,
 * and already preferred the document's own `issuer` over the declared one
 * (`resolveExternalConfig`) — which is the Microsoft case: it templates
 * `{tenantid}` in per-tenant metadata and the concrete value is what its tokens
 * carry. Re-deriving that preference here would duplicate amphora's resolution
 * AND could disagree with it: amphora scopes the fetched KEYS by the issuer it
 * settled on, so verifying against a different string would look up keys that
 * were never filed under it.
 *
 * `isString` rather than `??` on the endpoints, because amphora holds the
 * document as a `Partial` cast — a field is typed required but is not
 * guaranteed to be there.
 */
const toAuthEndpoints = (
  openid: OpenIdConfiguration,
  issuer: string,
): PylonAuthEndpoints => ({
  issuer,
  authorizationEndpoint: openid.authorizationEndpoint,
  tokenEndpoint: openid.tokenEndpoint,
  userinfoEndpoint: isString(openid.userinfoEndpoint) ? openid.userinfoEndpoint : null,
  introspectionEndpoint: isString(openid.introspectionEndpoint)
    ? openid.introspectionEndpoint
    : null,
  revocationEndpoint: isString(openid.revocationEndpoint)
    ? openid.revocationEndpoint
    : null,
  endSessionEndpoint: isString(openid.endSessionEndpoint)
    ? openid.endSessionEndpoint
    : null,
});

/**
 * Resolve the endpoint surface of the upstream IdP registered on amphora. The
 * shared implementation behind both discovery-backed drivers, so the relying
 * party and the resource server can never disagree about where the provider is.
 */
export const openIdEndpoints = (context: { amphora: IAmphora }): PylonAuthEndpoints =>
  toAuthEndpoints(getOpenIdConfiguration(context), resolveIdpIssuer(context));

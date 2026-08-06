import type { IAmphora } from "@lindorm/amphora";
import { isString } from "@lindorm/is";
import type { OpenIdConfiguration } from "@lindorm/openid";
import type { PylonAuthEndpoints } from "../../../../types/index.js";
import { getOpenIdConfiguration } from "../get-open-id-configuration.js";

/**
 * Project a discovery document onto the driver endpoint surface.
 *
 * ⚠ The document's OWN `issuer` wins over the configured one. Microsoft
 * templates `{tenantid}` in the metadata it serves per tenant and the concrete
 * value is what its tokens carry, so pylon must verify against what the
 * provider published, not against what the operator typed. `isString` rather
 * than `??` because amphora holds the document as a `Partial` cast — the field
 * is typed required but is not guaranteed to be there.
 */
const toAuthEndpoints = (
  openid: OpenIdConfiguration,
  issuer: string,
): PylonAuthEndpoints => ({
  issuer: isString(openid.issuer) ? openid.issuer : issuer,
  jwksUri: isString(openid.jwksUri) ? openid.jwksUri : null,
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
export const openIdEndpoints = (
  context: { amphora: IAmphora },
  issuer: string,
): PylonAuthEndpoints =>
  toAuthEndpoints(getOpenIdConfiguration(context, { issuer }), issuer);

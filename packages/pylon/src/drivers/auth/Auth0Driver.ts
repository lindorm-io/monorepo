import { isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { PylonAuthAuthorizeOptions } from "../../types/index.js";
import { OpenIdDriver } from "./OpenIdDriver.js";

/**
 * Auth0 — and the working proof that the seam is in the right place.
 *
 * Auth0 tenants without the RFC 8707 Resource Parameter Compatibility Profile
 * do not recognise `resource` and require the proprietary `audience` parameter
 * to issue a JWT access token. That is the WHOLE difference, and it is one
 * `authorizeQuery` override: no pylon-side flag, no vendor branch in the router,
 * nothing in `@lindorm/openid`, which stays RFC-only.
 */
export class Auth0Driver extends OpenIdDriver {
  protected override authorizeQuery(options: PylonAuthAuthorizeOptions): Dict {
    const { resource, ...query } = super.authorizeQuery(options);

    return isString(resource) ? { ...query, audience: resource } : query;
  }
}

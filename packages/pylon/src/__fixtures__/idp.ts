import nock from "nock";
import { OPEN_ID_JWKS_RESPONSE } from "./auth0.js";

/**
 * A registered upstream identity provider, for any suite that boots a pylon on a
 * DISCOVERY-BACKED driver — `OpenIdDriver`, `OpenIdResourceDriver`, `Auth0Driver`.
 *
 * Those drivers pin `amphora.idp`, so pylon refuses to boot without one. A suite
 * testing something else entirely (sessions, sources, cache storage) still has
 * to register a real upstream, because a pylon that boots without one is not a
 * deployment that exists.
 *
 * ⚠ Registered by `issuer` + `jwksUri`, so amphora settles the issuer from the
 * registration and fetches the KEYS ONLY — no discovery document is involved,
 * which is one nock instead of two. A suite whose driver reads the document
 * itself (`introspect`, `userinfo`, the negotiated auth methods) needs the
 * fuller `auth0` fixture instead.
 */
export const IDP_ISSUER = "https://idp.test.lindorm.io";

export const IDP_JWKS_URI = `${IDP_ISSUER}/.well-known/jwks.json`;

export const IDP_SETTINGS = { issuer: IDP_ISSUER, jwksUri: IDP_JWKS_URI };

/**
 * Serve the upstream's keys for the whole file. Call it at module scope, before
 * any `amphora.setup()` — the idp is always required, so a fetch that finds no
 * interceptor fails the boot it was registered for.
 */
export const nockIdp = (): void => {
  nock(IDP_ISSUER)
    .get("/.well-known/jwks.json")
    .times(999)
    .reply(200, OPEN_ID_JWKS_RESPONSE);
};

import { KryptosJwk } from "@lindorm/kryptos";

// Public, camelCase representation of the RFC 7800 `cnf` claim.
// Used by SignJwtContent and ParsedJwtPayload. The wire counterpart
// `ConfirmationClaimWire` lives in `./jwt/confirmation-claim-wire` and is
// consumed only by the wire<->public mapping layer in jwt-payload.ts.
//
// https://datatracker.ietf.org/doc/html/rfc7800
// https://datatracker.ietf.org/doc/html/rfc9449#section-6 (jkt)
// https://datatracker.ietf.org/doc/html/rfc8705#section-3 (x5t#S256)
export type ConfirmationClaim = {
  thumbprint?: string; // wire: jkt — DPoP JWK thumbprint
  mtlsCertThumbprint?: string; // wire: x5t#S256 — mTLS client certificate thumbprint
  key?: KryptosJwk; // wire: jwk
  keyId?: string; // wire: kid
  jwkSetUri?: string; // wire: jku
};

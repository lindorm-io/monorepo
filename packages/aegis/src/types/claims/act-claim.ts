// Public, camelCase representation of the RFC 8693 `act` / `may_act` claim.
// Used by SignJwtContent, ParsedJwtPayload, and TokenDelegation.
// The wire counterpart `ActClaimWire` lives in `./jwt/act-claim-wire` and is
// consumed only by the wire<->public mapping layer in jwt-payload.ts.
//
// https://datatracker.ietf.org/doc/html/rfc8693#section-4.1
export type ActClaim = {
  subject?: string;
  issuer?: string;
  audience?: Array<string>;
  clientId?: string;
  act?: ActClaim;
};

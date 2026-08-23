import type { Dict } from "@lindorm/types";

/**
 * The RFC 8693 actor claim in its WIRE vocabulary — the twin of `ActClaim`, and
 * open for the same reason: aegis carries a member it does not declare rather
 * than dropping it, and the tail travels verbatim. `open: "verbatim"` is declared
 * on the `act` and `may_act` codecs in `internal/claims/claims-registry.ts` for
 * the top level, and again on the nested `act` member in
 * `internal/claims/act-members.ts` for every depth below. RFC 8693 §4.1,
 * RFC 8693 §4.4.
 */
export type ActClaimWireMembers = {
  sub?: string;
  iss?: string;
  aud?: Array<string>;
  client_id?: string;
  act?: ActClaimWire;
};

export type ActClaimWire = ActClaimWireMembers & Dict;

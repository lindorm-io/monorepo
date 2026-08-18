import type { Dict } from "@lindorm/types";

/**
 * The RFC 8693 actor claim in its WIRE vocabulary — the twin of `ActClaim`, and
 * open for the same reason: §4.1 defines the members as "claims that identify the
 * actor", so a conformant issuer may write one aegis does not declare, and §4.4
 * offers `email` as an example. The tail travels verbatim.
 */
export type ActClaimWireMembers = {
  sub?: string;
  iss?: string;
  aud?: Array<string>;
  client_id?: string;
  act?: ActClaimWire;
};

export type ActClaimWire = ActClaimWireMembers & Dict;

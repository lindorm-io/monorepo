import type { Dict } from "@lindorm/types";

/**
 * The RFC 8693 actor claim in its WIRE vocabulary — the twin of `ActClaim`, and
 * open for the same reason: a conformant issuer may write a member aegis does not
 * declare (RFC 8693 §4.1, RFC 8693 §4.4). The tail travels verbatim.
 */
export type ActClaimWireMembers = {
  sub?: string;
  iss?: string;
  aud?: Array<string>;
  client_id?: string;
  act?: ActClaimWire;
};

export type ActClaimWire = ActClaimWireMembers & Dict;

import { ActClaimWire } from "./act-claim-wire";

// https://datatracker.ietf.org/doc/html/rfc8693 (act, may_act)
// https://datatracker.ietf.org/doc/html/rfc9068#section-2.2.3.1 (groups, entitlements)
export type ExtendedClaimsWire = {
  act?: ActClaimWire; // delegation chain
  may_act?: ActClaimWire; // actor authorized to act on behalf of subject
  groups?: Array<string>; // groups
  entitlements?: Array<string>; // entitlements
};

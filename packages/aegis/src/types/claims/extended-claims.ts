import { ActClaim } from "./act-claim";

// RFC 8693 §4.1 (act, may_act), RFC 9068 §2.2.3.1 (groups, entitlements).
export type ExtendedClaims = {
  act?: ActClaim;
  entitlements?: Array<string>;
  groups?: Array<string>;
  mayAct?: ActClaim;
};

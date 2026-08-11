import { CLAIM_SPECS, joseName } from "../claims/claims-registry.js";

// Wire-format (snake_case, i.e. JOSE) keys that belong to AegisProfile.
// Used by parseTokenPayload to partition incoming claim fields into
// `profile` (known AegisProfile fields) vs. `claims` (truly custom claims).
//
// DERIVED from the claim registry (`bucket: "profile"`) — the single source of
// truth — never a hand-kept list. Aegis-owned claims that have their own
// first-class fields on the payload (sub, permissions, roles, etc.) are
// `bucket: "claims"`, so filtering to `"profile"` excludes them exactly. The
// nested `address` object's inner keys are handled by camelKeys recursion
// downstream. A drift-guard test pins the derived set to the frozen wire-name
// list, so a registry edit can't silently change what parses as profile.
export const AEGIS_PROFILE_WIRE_KEYS: ReadonlySet<string> = new Set(
  CLAIM_SPECS.filter((spec) => spec.bucket === "profile").map(joseName),
);

import { CLAIM_SPECS, joseName } from "../claims/claims-registry.js";

// Wire-format (snake_case, i.e. JOSE) keys that belong to AegisProfile.
// Used by parseTokenPayload to partition incoming claim fields into
// `profile` (known AegisProfile fields) vs. `claims` (truly custom claims).
//
// DERIVED from the claim registry (`bucket: "profile"`) — the single source of
// truth — never a hand-kept list. Aegis-owned claims that have their own
// first-class fields on the payload (sub, permissions, roles, etc.) are
// `bucket: "claims"`, so filtering to `"profile"` excludes them exactly. A
// drift-guard test pins the derived set to the frozen wire-name list, so a
// registry edit can't silently change what parses as profile.
//
// ⚠ THIS SET IS TOP-LEVEL KEYS ONLY: the nested `address` object's inner keys
// are not in it.
//
// The sole consumer, `internal/utils/extract-aegis-profile.ts`, applies a DEEP
// `camelKeys` to the profile bag it assembles, which does reach inside an
// address. MEASURED, not assumed: that flip is a NO-OP on every production path.
// `extractAegisProfile` has exactly one production caller —
// `internal/claims/resolve-domain-buckets.ts#toBuckets` — and it is always handed
// the `claims` half of `wireToDomain`, so the members have already been resolved
// by the translator and are already camelCase when it runs. That holds for BOTH
// read doors: a token payload and the public `Aegis.toDomain` dict both reach it
// through `wireToDomain` first. The flip's wire-keyed branch is exercised only by
// `extract-aegis-profile.test.ts` calling the function directly.
//
// The introspection/userinfo path is `dictToBuckets -> toBuckets -> wireToDomain
// -> extractAegisProfile`, i.e. also after the translator.
export const AEGIS_PROFILE_WIRE_KEYS: ReadonlySet<string> = new Set(
  CLAIM_SPECS.filter((spec) => spec.bucket === "profile").map(joseName),
);

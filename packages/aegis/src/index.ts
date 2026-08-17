export * from "./classes/index.js";
export * from "./errors/index.js";
export * from "./utils/index.js";
export * from "./interfaces/index.js";
export * from "./types/index.js";

export { FAPI_SIG_ALGS } from "./constants/fapi.js";

// The `VerifyOptions` knob keys, derived from the wire-parity table. Public so a
// consumer splitting a flat matcher-and-knob bag reads the set from its owner
// instead of copying it (pylon's copy drifted twice).
export { VERIFY_OPTION_KEYS } from "./internal/constants/verify-option-parity.js";

// The two claim-presence predicates the profile floor is built from. Public
// because a consumer-registered profile's `requiredWhen` `when` predicate is
// caller code reading the SAME claim bag the floor reads, and a caller without
// the vocabulary invents a fourth notion of presence (truthiness) that agrees
// with neither. `isClaimSatisfied` is the demand notion (`required`), and
// `isClaimOmitted` the vocabulary notion (`forbidden`) — they are NOT each
// other's complement; `internal/utils/rules/index.ts` states why.
export { isClaimOmitted, isClaimSatisfied } from "./internal/utils/rules/index.js";

export type { TokenType } from "./constants/token-type.js";

// `DomainClaims` — the unified domain claim set carried by `VerifiedToken.claims`
// / `ParsedToken.claims` — is exported with the rest of the domain claim types
// (`types/claims/domain/`), which is where it now lives. Public because consumers
// hold claims apart from the result that produced them — pylon's resolved access
// state types its `claims` with it.

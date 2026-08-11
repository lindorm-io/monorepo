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

export type { TokenType } from "./constants/token-type.js";

// The unified domain claim set carried by `VerifiedToken.claims` / `ParsedToken.claims`.
// Public because consumers hold claims apart from the result that produced them —
// pylon's resolved access state types its `claims` with it.
export type { DomainClaims } from "./internal/utils/extract-claims.js";

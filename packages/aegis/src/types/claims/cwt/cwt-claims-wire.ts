import { COSE_CLAIMS } from "#internal/constants/cose";

// Static CWT label union derived from the COSE_CLAIMS table so there's exactly
// one place to look up "what does label 500 mean" — `internal/constants/cose.ts`.
// The runtime shape is Map<number | string, unknown>; unknown string keys
// are permitted so callers can stash custom claims that don't have a COSE label.
export type CwtClaimLabel = (typeof COSE_CLAIMS)[number]["label"];

export type CwtClaimsWire = Map<CwtClaimLabel | string, unknown>;

import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { pruneEmptyClaims } from "../claims/prune-empty-claims.js";

/**
 * The single normalisation applied to a claims dict just before it is serialised
 * — shared by JOSE and COSE so both wires behave identically. TWO strips, neither
 * of them a choice:
 *
 *   1. `undefined`, recursively. It is the one value with no semantic ambiguity:
 *      the absent property of a bag assembled from optional fields, on every
 *      wire, for every caller. Nobody writes `undefined` to mean something.
 *   2. The empty value of a claim whose registry entry says that empty value
 *      carries nothing ({@link pruneEmptyClaims}). Per CLAIM, top level only, and
 *      a key the registry does not know is never touched.
 *
 * ⚠ THE REGISTRY DECIDES, NOT THE CALLER, and that is the whole point. Whether an
 * empty value is a statement or noise is a fact about the CLAIM — an empty RFC
 * 9396 `actions` grants no action while an absent one is not restricted by action
 * at all, and an `amr: []` asserts that the authentication methods are known and
 * none applied, which no issuer means. A caller-facing mode made that per-CALL
 * what is per-CLAIM: the same `amr: []` was emitted or dropped depending on a knob
 * the issuer set for unrelated reasons, so the token said two different things
 * about the subject with nothing on the wire to tell them apart. The registry's
 * `whenEmpty` cell answers it once, for everyone, and is pinned by name in
 * `claims-registry.test.ts`.
 */
export const normaliseClaims = <T extends Dict = Dict>(dict: T): T =>
  pruneEmptyClaims(omitUndefined(dict));

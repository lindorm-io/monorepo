/**
 * How aggressively a minted token's claim dict is pruned at the emission
 * boundary:
 *
 * - `"empty"` — drop `undefined`, `null`, `""`, `[]`, and `{}` recursively, so
 *   the wire stays COMPACT. The default on the CLAIMS-writing verbs.
 * - `"undefined"` — drop only `undefined`, preserving explicit empty values.
 *
 * Unstated, the claims verbs prune `"empty"` and `aegis.encrypt` prunes nothing
 * — see `DomainTokenEnvelope.omit` for why the two defaults differ.
 *
 * Public because it is the type of `omit` on every domain write option
 * (`ProfileMintOptions`, `RawSignInput`, `EncryptOptions`, `SignTokenOptions`).
 * It reached those signatures from `internal/`, so a consumer annotating a
 * variable it was about to pass had no name to reach for.
 */
export type OmitMode = "empty" | "undefined";

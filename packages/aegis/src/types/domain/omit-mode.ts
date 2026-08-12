/**
 * How aggressively a minted token's claim dict is pruned at the emission
 * boundary:
 *
 * - `"empty"` (default) — drop `undefined`, `null`, `""`, `[]`, and `{}`
 *   recursively, so the wire stays COMPACT.
 * - `"undefined"` — drop only `undefined`, preserving explicit empty values.
 *
 * Public because it is the type of `omit` on every domain write option
 * (`ProfileMintOptions`, `RawSignInput`, `EncryptOptions`, `SignTokenOptions`).
 * It reached those signatures from `internal/`, so a consumer annotating a
 * variable it was about to pass had no name to reach for.
 */
export type OmitMode = "empty" | "undefined";

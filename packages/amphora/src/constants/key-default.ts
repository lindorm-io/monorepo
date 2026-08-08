import type { AmphoraCondition } from "../types/index.js";

/**
 * The canonical key-selection DEFAULT — deliberately a separate file from the
 * floors, because it is the OPPOSITE kind of thing and the two are easy to
 * conflate. A floor is spread LAST and can never be overridden; a default is
 * spread FIRST among the caller layers, so the caller's own condition wins:
 *
 *   applyKeyFloor(ENVELOPE_FLOOR, ENVELOPE_DEFAULT, callerCondition)
 *                 └ never overridable  └ overridable   └ wins over the default
 *
 * ENVELOPE encryption is self-encryption: a proteus `@Encrypted` column, an iris
 * message, a pylon cookie or session — sealed by a key the same deployment must
 * reopen. Such a key never leaves the service and never belongs in a JWKS, so
 * `publish: false` is what a caller means when it names no `publish` at all.
 *
 * Without this layer the query falls through to amphora's default publish gate,
 * which hides exactly those keys (see `AmphoraState.filteredKeys`) — so an
 * envelope selector that named no `publish` could only ever reach the PUBLISHED
 * set, i.e. the JWKS token key, or nothing. Naming `publish` by hand was the
 * workaround; this is the fix.
 *
 * It stays a DEFAULT rather than becoming a second floor because `publish` is
 * consumer policy everywhere else in the toolkit: a deployment that genuinely
 * wants to seal with a published key states `publish: true` and gets it.
 */
export const ENVELOPE_DEFAULT: AmphoraCondition = { publish: false };

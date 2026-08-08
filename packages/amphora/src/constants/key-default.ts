import type { AmphoraCondition } from "../types/index.js";

/**
 * The canonical key-selection DEFAULT — deliberately a separate file from the
 * floors, because it is the OPPOSITE kind of thing and the two are easy to
 * conflate. A floor is spread LAST and can never be overridden; a default is
 * spread FIRST among the caller layers, so the caller's own condition wins:
 *
 *   applyKeyFloor(SOME_FLOOR, UNPUBLISHED_DEFAULT, callerCondition)
 *               └ never overridable  └ overridable    └ wins over the default
 *
 * It says ONE thing: look at OUR OWN keys, not the published set. Amphora's
 * query gate hides a key that is both ours and unpublished from any selector
 * that names no `publish` (see `AmphoraState.filteredKeys`), so without this
 * layer such a selector could only ever reach the PUBLISHED keys — the JWKS
 * token key — or nothing at all. Spelling `publish: false` in every consumer's
 * config was the workaround; this is the fix.
 *
 * WHERE IT BELONGS: any operation whose artifact never leaves this deployment,
 * so that this deployment is the only party that ever reads it back.
 *   - Envelope encryption — a proteus `@Encrypted` column, an iris message, a
 *     pylon cookie or session. Sealed by a key we must reopen ourselves.
 *   - A pylon COOKIE signature. Nobody else verifies it; the key is ours in
 *     exactly the same sense, so the same answer is right.
 *
 * ⚠ WHERE IT DOES NOT BELONG — the name says `publish`, not "safe":
 *   - TOKEN signing. A token signature exists to be verified by a relying party
 *     against our JWKS, so its key MUST be published. Aegis therefore applies
 *     no default at all (`Aegis.resolveSignKey` — floor plus the deployment's
 *     own selector), and must not be given one. The floors are shared; this
 *     default is not, and `SIGN_FLOOR` appearing in both proves nothing.
 *   - A CHECK rather than a query. Where a key is resolved by `kid` through the
 *     unfiltered `findById`/`findByIdSync` and the condition is then matched
 *     against the resolved key, there is no gate to reach past — a default
 *     stops being "where to look" and silently becomes an assertion that the
 *     key is unpublished. Pylon's cookie VERIFICATION is that shape, and gets
 *     no default.
 *
 * It stays a DEFAULT rather than becoming a second floor because `publish` is
 * consumer policy everywhere in the toolkit: a deployment that genuinely wants
 * a published key states `publish: true` and gets it.
 */
export const UNPUBLISHED_DEFAULT: AmphoraCondition = { publish: false };

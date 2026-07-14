import type { AmphoraPredicate } from "@lindorm/amphora";

/**
 * The FLOOR of at-rest field encryption: the minimum that makes the operation
 * POSSIBLE — nothing else. It is enforced on every key that reaches the crypto
 * layer, however it got there (selected from the vault, named by a ciphertext's
 * own `kid`, or injected outright), and it is deliberately absent from
 * `ProteusEncryptionPredicate`, so a consumer cannot express it, let alone widen
 * it.
 *
 * There are TWO floors, because at-rest encryption runs in two DIRECTIONS and
 * they do not want the same thing.
 *
 * - `use: "enc"` — an encryption key, not a signing key. On both floors.
 *
 * - `hasPrivateKey: true` — at-rest encryption must work in BOTH directions: you
 *   must be able to decrypt what you encrypted. A public-only key (a recipient
 *   key from someone's JWKS) would encrypt a column and then never open it again.
 *   It excludes every remotely-fetched key for free — a JWKS only ever yields
 *   public halves. This is a genuine invariant, not policy. On both floors.
 *
 * The floors carry NO `purpose`: `purpose` is advisory and consumer-owned, and
 * guessing one is how a lookup silently lands on the wrong key.
 */

/**
 * WRITE. The key must be usable NOW — `isActive`.
 *
 * `filteredKeys` already drops inactive keys from a vault QUERY, so the clock
 * bites where the vault does not: an INJECTED `kryptos` (an env KEK handed to
 * `@Encrypted({ kryptos })`) never touches the vault at all. Without the clock
 * here, an expired or not-yet-valid KEK would happily encrypt the database.
 */
export const ENCRYPTION_FLOOR: AmphoraPredicate = {
  use: "enc",
  hasPrivateKey: true,
  isActive: true,
};

/**
 * READ. The key must have been usable at SOME point — `isPending: false` — and
 * that is ALL. Deliberately NOT `isActive`.
 *
 * A column is written once and read for years. `findByIdSync` is unfiltered by
 * design precisely so a column encrypted by a since-rotated key still opens; an
 * EXPIRED key MUST therefore still decrypt, or every KEK rotation would destroy
 * the data it left behind. That is the whole reason a key carries an `expiresAt`
 * rather than vanishing.
 *
 * But the ciphertext NAMES its own key, so the `kid` is chosen by whoever wrote
 * the row — and a key whose `notBefore` has not passed cannot have encrypted
 * anything, ever. Nothing it names is real, so `isPending` is refused.
 */
export const DECRYPTION_FLOOR: AmphoraPredicate = {
  use: "enc",
  hasPrivateKey: true,
  isPending: false,
};

/**
 * The DEFAULT — overridable, unlike the floor: the caller's predicate wins.
 *
 * A field-encryption key is a KEK. It never leaves the service and never belongs
 * in a JWKS, so an unpublished key is the right default — and amphora's own
 * filter defaults to `publish: true`, so WITHOUT this a KEK is invisible. But
 * `publish` is consumer policy everywhere else in the toolkit, so it stays a
 * default rather than becoming a second floor.
 */
export const ENCRYPTION_DEFAULT: AmphoraPredicate = { publish: false };

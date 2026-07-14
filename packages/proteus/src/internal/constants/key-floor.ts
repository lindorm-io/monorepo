import type { AmphoraPredicate } from "@lindorm/amphora";

/**
 * The FLOOR of at-rest field encryption: the minimum that makes the operation
 * POSSIBLE — nothing else. It is enforced on every key that reaches the crypto
 * layer, however it got there (selected from the vault or injected outright),
 * and it is deliberately absent from `ProteusEncryptionPredicate`, so a consumer
 * cannot express it, let alone widen it.
 *
 * - `use: "enc"` — an encryption key, not a signing key.
 *
 * - `hasPrivateKey: true` — at-rest encryption must work in BOTH directions: you
 *   must be able to decrypt what you encrypted. A public-only key (a recipient
 *   key from someone's JWKS) would encrypt a column and then never open it again.
 *   It excludes every remotely-fetched key for free — a JWKS only ever yields
 *   public halves. This is a genuine invariant, not policy.
 *
 * The floor carries NO `purpose`: `purpose` is advisory and consumer-owned, and
 * guessing one is how a lookup silently lands on the wrong key.
 */
export const ENCRYPTION_FLOOR: AmphoraPredicate = { use: "enc", hasPrivateKey: true };

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

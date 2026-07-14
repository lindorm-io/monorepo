import type { AmphoraPredicate } from "@lindorm/amphora";
import type { IrisEncryptionPredicate } from "../../types/encryption.js";

/**
 * The FLOOR of message encryption: the minimum that makes the operation
 * possible — nothing else. A floor is POLICY, enforced on every key that
 * reaches the crypto layer, however it got there (selected from the vault,
 * named by an encrypted payload's `kid`, or injected outright on a decorator).
 * It is absent from `IrisEncryptionPredicate` by construction, so a caller
 * cannot express it, let alone widen it.
 *
 * - `use: "enc"` — an `AesKit` will happily take a signing key. Without this,
 *   the newest key in the vault decides what encrypts your messages.
 *
 * - `hasPrivateKey: true` — message encryption runs in BOTH directions in the
 *   same deployment: whatever encrypts a message must also be able to decrypt
 *   it. A public-only recipient key could encrypt and never decrypt. It also
 *   excludes every remotely-fetched key for free (a JWKS only yields public
 *   halves), which is right: a message KEK is never someone else's key.
 *
 * The floor carries no `purpose`, no `publish` and no `internal` — those are
 * consumer policy, expressible in the consumer's own predicate.
 */
export const ENCRYPTION_FLOOR: AmphoraPredicate = { use: "enc", hasPrivateKey: true };

/**
 * The DEFAULT vault query — overridable, unlike the floor: the caller's
 * predicate wins on any key it names.
 *
 * A message KEK never leaves the service, so `publish: false` is the right
 * default — and amphora's own filter defaults to `publish: true`, so without it
 * an internal KEK is invisible to every query. But `publish` is consumer policy
 * everywhere else in the toolkit, so a caller who means it keeps the last word.
 */
export const ENCRYPTION_DEFAULT: IrisEncryptionPredicate = { publish: false };

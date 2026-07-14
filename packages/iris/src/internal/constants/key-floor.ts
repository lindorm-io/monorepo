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
 * There are TWO floors, because message encryption runs in two DIRECTIONS and
 * they do not want the same thing.
 *
 * - `use: "enc"` — an `AesKit` will happily take a signing key. Without this,
 *   the newest key in the vault decides what encrypts your messages. On both
 *   floors.
 *
 * - `hasPrivateKey: true` — message encryption runs in BOTH directions in the
 *   same deployment: whatever encrypts a message must also be able to decrypt
 *   it. A public-only recipient key could encrypt and never decrypt. It also
 *   excludes every remotely-fetched key for free (a JWKS only yields public
 *   halves), which is right: a message KEK is never someone else's key. On both
 *   floors.
 *
 * The floors carry no `purpose`, no `publish` and no `internal` — those are
 * consumer policy, expressible in the consumer's own predicate.
 */

/**
 * WRITE. The key must be usable NOW — `isActive`.
 *
 * The vault already drops inactive keys from a QUERY, so the clock bites where
 * the vault does not: an INJECTED `kryptos` (typically an env KEK on the
 * `@Encrypted` decorator) never touches the vault at all. Without the clock
 * here, an expired or not-yet-valid KEK would wrap live messages.
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
 * `findById` is unfiltered by design so that a message encrypted with a
 * since-rotated key still decrypts; an EXPIRED key MUST therefore still open
 * what it sealed while it was valid, or every rotation would strand the messages
 * already on the wire. That is the whole reason a key carries an `expiresAt`
 * rather than vanishing.
 *
 * But the payload NAMES its own key, so the `kid` is chosen by whoever produced
 * it — and a key whose `notBefore` has not passed cannot have sealed anything,
 * ever. Nothing it names is real, so `isPending` is refused.
 */
export const DECRYPTION_FLOOR: AmphoraPredicate = {
  use: "enc",
  hasPrivateKey: true,
  isPending: false,
};

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

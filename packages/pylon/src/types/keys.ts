import type { AmphoraKeySelector, AmphoraQuery } from "@lindorm/amphora";
import type { KryptosEncryption } from "@lindorm/kryptos";
import type { Predicate } from "@lindorm/types";

/**
 * The key attributes a pylon deployment may select on.
 *
 * Pylon OWNS the floor — `use` and `hasPrivateKey` — so those are absent here
 * BY CONSTRUCTION: a deployment cannot express them, let alone widen them.
 *
 * Everything else — including `purpose`, `publish` and `internal` — is the
 * DEPLOYMENT's policy and belongs to it. Pylon used to guess all three
 * (`purpose: { $in: ["cookie", "session"] }` hard-coded in the cookie signer),
 * which is why the keys had to exist by convention. They no longer do: the
 * deployment names them.
 */
type PylonKeyAttributes = Pick<
  AmphoraQuery,
  | "id"
  | "algClass"
  | "algorithm"
  | "curve"
  | "internal"
  | "issuer"
  | "ownerId"
  | "publish"
  | "purpose"
  | "type"
>;

export type PylonKeyPredicate = Predicate<PylonKeyAttributes>;

/**
 * Selects the key that SIGNS cookies.
 *
 * `kryptos` is a key supplied outright — e.g. an env-imported cookie secret that
 * never reaches the vault. It skips the vault query, never the floor.
 *
 * `predicate` is which of the vault's keys. ⚠ Amphora's default query is the
 * PUBLISHED set, so an internal cookie key needs `publish: false` to be
 * reachable at all.
 */
export type PylonSignKey = AmphoraKeySelector<PylonKeyPredicate>;

/**
 * The read side, cookie signatures. The key is resolved from the cookie's own
 * `.kid`, so a predicate cannot be a QUERY here — but it is exactly right as a
 * CHECK, applied to the resolved key before any signature is touched. Without
 * it, a client that can name any kid in the vault picks the class of key its
 * cookie is verified against.
 *
 * ⚠ DELIBERATELY NOT an `AmphoraKeySelector` — it carries no `kryptos` because
 * the cookie names the one key that can check it. Same shape, same reason, as
 * aegis's `AegisVerifyKey`.
 */
export type PylonVerifyKey = {
  predicate?: PylonKeyPredicate;
};

/**
 * Selects the key that ENCRYPTS a cookie value or a stored session's tokens.
 * Handed to `aegis.aes.encrypt`, which owns the encryption floor (`use: "enc"`).
 */
export type PylonEncKey = AmphoraKeySelector<PylonKeyPredicate> & {
  /**
   * The AES content-encryption AEAD (`A256GCM`, …). This picks the CIPHER, never
   * the key — it is not a selector, which is why it sits beside the shared
   * selector rather than inside it.
   */
  encryption?: KryptosEncryption;
};

/**
 * The three key ROLES pylon resolves for a cookie. One shape, used twice — for
 * cookies in general and for the session cookie in particular.
 */
export type PylonKeyRoles = {
  /** Signs the cookie (`<name>.sig` / `<name>.kid`). */
  signature?: PylonSignKey;
  /**
   * Checked on the key the cookie's `.kid` names, before its signature is
   * verified.
   *
   * Defaults to THIS scope's `signature` predicate, and that default is
   * load-bearing — do not "simplify" it away. Verification asks *is the key that
   * signed this cookie one of the keys I would have signed it with?*, which IS
   * the signing policy; a verification predicate that does not follow the
   * signature can only ever reject a cookie we ourselves just issued. (Name
   * `session.signature` alone, let the check fall through to
   * `cookie.verification`, and every session cookie fails on the next read.)
   *
   * Name it explicitly only to make the read policy genuinely BROADER than the
   * write policy — accepting a key rotated out of the current signing predicate,
   * say. When the scope's `signature` is an injected `kryptos` there is no
   * predicate to inherit, and the floor (`use: "sig"`) applies alone: the
   * cookie's `.kid` already names the key.
   */
  verification?: PylonVerifyKey;
  /** Encrypts the cookie's value (`encrypted: true`). */
  encryption?: PylonEncKey;
};

/**
 * Which key does what. Pylon holds no opinion about a deployment's key taxonomy
 * — it does not know your `purpose` names and will not invent them — so every
 * key ROLE it resolves is named here, or it is not resolved at all.
 *
 * **A pylon session IS a cookie.** With a kv store the cookie carries the
 * session id and the tokens are sealed at rest; without one the whole session
 * object — tokens and all — travels IN the cookie. Either way the artifact on
 * the wire is a cookie, which is why `session` is not a separate key taxonomy
 * but a per-role OVERRIDE of `cookie`:
 *
 *     session.<role> ?? cookie.<role>
 *
 * Name only `cookie` and one set of keys does everything. Name `session` too and
 * the session cookie is signed / sealed with its OWN key — a different blast
 * radius, or an asymmetric signature for session cookies specifically — while
 * every ordinary cookie keeps using the `cookie` keys.
 *
 * `verification` carries ONE extra fallback on top of that chain: within a
 * scope, it defaults to that scope's own `signature` predicate. So naming
 * `session.signature` alone is sufficient — the session cookie signs AND reads
 * back. See `PylonKeyRoles.verification` for why that is a correctness
 * requirement rather than a convenience.
 *
 * The read side of ENCRYPTION is deliberately absent from both: ciphertext names
 * its own key, so `aegis.aes.decrypt` resolves it by kid and a selector could
 * only ever contradict it. (Signature verification is the other way round — the
 * `.kid` is the CLIENT's claim, so `verification` exists to check it.)
 */
export type PylonKeys = {
  /**
   * The keys every cookie uses unless the cookie names its own.
   *
   * `signature` is REQUIRED to sign a cookie: without it pylon would fall back
   * to the floor alone, which resolves to whatever published key is newest — in
   * practice the JWKS token key, which is exactly the bug this option removes.
   * No key named, no cookie signed. Since `session` chains to `cookie`, a
   * session cookie is signable iff a cookie signing key is named.
   */
  cookie?: PylonKeyRoles;
  /**
   * The session cookie's keys. Every role falls back to its `cookie`
   * counterpart:
   *
   * - `signature` — falls back to `cookie.signature`
   * - `verification` — falls back to `session.signature`'s predicate, then to
   *   `cookie.verification`, then to `cookie.signature`'s predicate. Naming a
   *   session signing key is therefore ENOUGH; there is no second option you can
   *   forget.
   * - `encryption` — falls back to `cookie.encryption` (and is what seals a
   *   stored session's tokens at rest, as well as a cookie-only session's whole
   *   body)
   */
  session?: PylonKeyRoles;
};

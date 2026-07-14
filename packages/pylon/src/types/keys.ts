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
 * Which key does what. Pylon holds no opinion about a deployment's key taxonomy
 * — it does not know your `purpose` names and will not invent them — so every
 * key ROLE it resolves is named here, or it is not resolved at all.
 *
 * The read side (cookie decryption) is deliberately absent: ciphertext names its
 * own key, so `aegis.aes.decrypt` resolves it by kid and a selector could only
 * ever contradict it.
 */
export type PylonKeys = {
  /**
   * Signs cookies (`<name>.sig` / `<name>.kid`). REQUIRED to sign a cookie:
   * without it pylon would fall back to the floor alone, which resolves to
   * whatever published key is newest — in practice the JWKS token key, which is
   * exactly the bug this option removes. No key named, no cookie signed.
   */
  cookieSignature?: PylonSignKey;
  /**
   * Checked on the key a cookie's `.kid` names, before its signature is
   * verified. Optional — the floor (`use: "sig"`) applies either way.
   */
  cookieVerification?: PylonVerifyKey;
  /** Encrypts cookie values (`encrypted: true`). */
  cookieEncryption?: PylonEncKey;
  /** Encrypts the tokens a server-side session holds at rest. */
  sessionEncryption?: PylonEncKey;
};

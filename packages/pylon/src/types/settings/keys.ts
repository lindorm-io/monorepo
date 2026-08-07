import type { Condition } from "@lindorm/match";
import type { AmphoraKeySelector, AmphoraQuery } from "@lindorm/amphora";
import type { KryptosEncryption } from "@lindorm/kryptos";

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

export type PylonKeyCondition = Condition<PylonKeyAttributes>;

/**
 * Selects the key that SIGNS cookies.
 *
 * `kryptos` is a key supplied outright — e.g. an env-imported cookie secret that
 * never reaches the vault. It skips the vault query, never the floor.
 *
 * `condition` is which of the vault's keys. ⚠ Amphora's default query is the
 * PUBLISHED set, so an internal cookie key needs `publish: false` to be
 * reachable at all.
 */
export type PylonSignKey = AmphoraKeySelector<PylonKeyCondition>;

/**
 * The read side, cookie signatures. The key is resolved from the cookie's own
 * `.kid`, so a condition cannot be a QUERY here — but it is exactly right as a
 * CHECK, applied to the resolved key before any signature is touched. Without
 * it, a client that can name any kid in the vault picks the class of key its
 * cookie is verified against.
 *
 * ⚠ DELIBERATELY NOT an `AmphoraKeySelector` — it carries no `kryptos` because
 * the cookie names the one key that can check it. Same shape, same reason, as
 * aegis's `AegisVerifyKey`.
 */
export type PylonVerifyKey = {
  condition?: PylonKeyCondition;
};

/**
 * Selects the key that ENCRYPTS a cookie value or a stored session's tokens.
 * Handed to `aegis.aes.encrypt`, which owns the encryption floor (`use: "enc"`).
 *
 * ⚠ Named for its PATH, and one of a pair with {@link PylonColumnEncKey}: pylon
 * runs two encryption paths that take the same `{ kryptos?, condition? }`
 * selector but do NOT take the same extras, and a single shared type meant three
 * of five settings accepted an `encryption` AEAD that was silently discarded.
 * The type now states which path it belongs to, so nothing has to be remembered.
 */
export type PylonCookieEncKey = AmphoraKeySelector<PylonKeyCondition> & {
  /**
   * The AES content-encryption AEAD (`A256GCM`, …). This picks the CIPHER, never
   * the key — it is not a selector, which is why it sits beside the shared
   * selector rather than inside it. Omitted ⇒ aegis's deployment-wide
   * `encryption` (itself defaulting to `A256GCM`).
   */
  encryption?: KryptosEncryption;
};

/**
 * Selects the KEK that proteus seals an `@Encrypted()` column with — the stored
 * private key, the webhook delivery credentials, the cached auth payloads.
 *
 * ⚠ It carries NO AEAD, unlike {@link PylonCookieEncKey}: proteus owns the
 * cipher on the KEK path (it derives the content encryption from the resolved
 * key), so pylon has nothing to pick. Selecting the key is the whole surface,
 * which is what makes the staging mapping total — every member of this type
 * reaches proteus.
 */
export type PylonColumnEncKey = AmphoraKeySelector<PylonKeyCondition>;

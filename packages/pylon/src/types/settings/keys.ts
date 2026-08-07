import type { Condition } from "@lindorm/match";
import type { AmphoraKeySelector, AmphoraQuery } from "@lindorm/amphora";

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
 * Selects the key that ENCRYPTS — a cookie value, a stored session's tokens, or
 * an `@Encrypted()` column (the stored private key, the webhook delivery
 * credentials, the cached auth payloads).
 *
 * ⚠ ONE type for both paths, and it selects the KEY and nothing else. It was
 * briefly split in two because the cookie path took an AEAD the column path
 * did not; that member is gone. The AEAD is a property of the key — aegis and
 * proteus both read the resolved key's own `encryption` — so pylon has nothing
 * to pick on either path, and the two paths have nothing left to disagree
 * about. That is also what keeps the proteus mapping TOTAL: every member of
 * this type reaches proteus.
 */
export type PylonEncKey = AmphoraKeySelector<PylonKeyCondition>;

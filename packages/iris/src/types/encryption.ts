import type { AmphoraKeySelector, AmphoraQuery } from "@lindorm/amphora";
import type { Condition } from "@lindorm/match";

/**
 * The attributes a consumer may select a message-encryption key by.
 *
 * Iris OWNS the floor — `use` and `hasPrivateKey` — so they are absent here BY
 * CONSTRUCTION: a caller cannot express them, let alone widen them. Message
 * encryption must work in BOTH directions (you must be able to decrypt what you
 * encrypted), and only `hasPrivateKey` can guarantee that; it also excludes
 * every remotely-fetched key for free, since a JWKS only ever yields public
 * halves.
 *
 * Everything else — including `purpose`, `publish` and `internal` — is the
 * CONSUMER's policy and belongs to them.
 */
type IrisEncryptionAttributes = Pick<
  AmphoraQuery,
  | "id"
  | "algorithm"
  | "curve"
  | "encryption"
  | "internal"
  | "issuer"
  | "ownerId"
  | "publish"
  | "purpose"
  | "type"
>;

/**
 * Selects the message-encryption key from the vault. A `kid` is `{ id }`; a
 * dedicated message KEK is `{ purpose: "message" }`; an allowlist is
 * `{ algorithm: { $in: [...] } }`.
 */
export type IrisEncryptionPredicate = Condition<IrisEncryptionAttributes>;

/**
 * How a message NAMES its encryption key: a key supplied outright, or a query
 * for one. Exactly one of the two must resolve — from the decorator or from the
 * source-level default — or the source refuses to load. An unscoped lookup
 * ("whatever key is newest") is not a policy.
 *
 * - `kryptos` — a key supplied outright. Typically an env-imported KEK
 *   (`KryptosKit.env.import(process.env.KEK!)`), which is available at module
 *   load, so it can be handed to a class decorator. It never came from the
 *   vault, so a `predicate` is meaningless for it — but the FLOOR still applies,
 *   which is what makes injection safe rather than an escape hatch.
 * - `predicate` — which of the vault's keys.
 */
export type IrisEncryptionKey = AmphoraKeySelector<IrisEncryptionPredicate>;

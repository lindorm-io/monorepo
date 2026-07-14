import type { AmphoraKeySelector, AmphoraQuery } from "@lindorm/amphora";
import type { Predicate } from "@lindorm/types";

/**
 * The key attributes a consumer may select an at-rest encryption key by.
 *
 * Proteus OWNS the floor — `use` and `hasPrivateKey` — so they are absent here
 * BY CONSTRUCTION: a caller cannot express them, let alone widen them. A column
 * encrypted with a signing key, or with a public-only key that can never decrypt
 * it again, is not a policy choice a consumer gets to make.
 *
 * Everything else — including `purpose`, `publish` and `internal` — is CONSUMER
 * policy and belongs to them.
 */
type ProteusEncryptionAttributes = Pick<
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
 * Selects the at-rest encryption key for an `@Encrypted` field. A `kid` is
 * `{ id }`; a KEK minted by a scaffold is `{ purpose: "pylon:kek" }`; an
 * allowlist is `{ algorithm: { $in: [...] } }`.
 */
export type ProteusEncryptionPredicate = Predicate<ProteusEncryptionAttributes>;

/**
 * How an `@Encrypted` field NAMES its key: an explicit key, or a query for one.
 *
 * - `kryptos` — a key supplied outright. A KEK is typically an env key
 *   (`KryptosKit.env.import(process.env.KEK!)`), which is available at class
 *   definition time, so it can be handed straight to the decorator. It never
 *   came from the vault, so a `predicate` is meaningless for it — but the FLOOR
 *   still applies, which is what makes injection safe rather than an escape hatch.
 * - `predicate` — which of the vault's keys.
 *
 * One of them is REQUIRED, from the decorator or the source-level default —
 * enforced when the source loads. There is no unscoped lookup: "which key
 * encrypts my database" must not have an implicit answer.
 */
export type ProteusEncryptionKey = AmphoraKeySelector<ProteusEncryptionPredicate>;

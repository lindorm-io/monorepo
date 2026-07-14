import type { AmphoraQuery, IAmphora } from "@lindorm/amphora";
import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Predicate } from "@lindorm/types";
import type { CertBindingMode } from "./header.js";

/**
 * The key attributes a caller may select on.
 *
 * Aegis OWNS the floor — `use`, `hasPrivateKey` and `hasPublicKey` — so those
 * are absent here BY CONSTRUCTION: a caller cannot express them, let alone
 * widen them. `operations` is absent for a different reason: it is a derived
 * capability of the key material, so the floor's `hasPrivateKey` already
 * answers the only question it could ask (and answers it correctly for
 * `ECDH-ES`, where the declared operations cannot tell encrypt from decrypt).
 *
 * Everything else — including `purpose`, `publish` and `internal` — is the
 * CONSUMER's policy and belongs to them.
 */
type AegisKeyAttributes = Pick<
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

/**
 * Selects a signing / verification key. A `kid` is `{ id }`; a per-client
 * algorithm is `{ algorithm: client.idTokenSignedResponseAlg }`; an allowlist
 * is `{ algorithm: { $in: [...] } }`.
 */
export type AegisSignPredicate = Predicate<AegisKeyAttributes>;

/** Selects an encryption / decryption key. Same attributes as the sign side. */
export type AegisEncPredicate = Predicate<AegisKeyAttributes>;

export type AegisSignKey = {
  /**
   * A key supplied outright — e.g. an OIDC client secret used as the `HS256`
   * MAC key for an id_token (Core §10.1). Never a vault resident, so the
   * SELECTOR (`predicate`) does not apply to it — but the profile FLOOR still
   * does, which is what makes injection safe rather than an escape hatch.
   */
  kryptos?: IKryptos;
  /** Which of the vault's keys. Meaningless for an injected `kryptos`. */
  predicate?: AegisSignPredicate;
};

export type AegisEncKey = {
  /** A key supplied outright — e.g. a client secret used as an `A128KW` wrap key. */
  kryptos?: IKryptos;
  /**
   * The JWE / COSE content-encryption AEAD (`A256GCM`, …). This picks the
   * CIPHER, never the key — it is not a selector.
   */
  encryption?: KryptosEncryption;
  /** Which of the vault's keys. Meaningless for an injected `kryptos`. */
  predicate?: AegisEncPredicate;
};

/**
 * The read side. The key is resolved from the token's own `kid`, so a predicate
 * cannot be a QUERY here — but it is exactly right as a CHECK, applied to the
 * resolved key before any signature or ciphertext is touched. That closes the
 * RFC 8725 §3.1 hole: without it, an attacker who can name any `kid` in the
 * vault picks the verification key's class.
 */
export type AegisVerifyKey = {
  predicate?: AegisSignPredicate;
};

export type AegisDecryptKey = {
  predicate?: AegisEncPredicate;
};

export type AegisOptions = {
  amphora: IAmphora;
  logger: ILogger;
  issuer?: string;

  certBindingMode?: CertBindingMode;
  clockTolerance?: number;
  dpopMaxSkew?: number;
  encryption?: KryptosEncryption;

  /** Deployment signing policy — a QUERY over the vault. */
  sign?: AegisSignKey;
  /** Deployment encryption policy — a QUERY over the vault. */
  encrypt?: AegisEncKey;
  /** Deployment verification policy — a CHECK on the key the token names. */
  verify?: AegisVerifyKey;
  /** Deployment decryption policy — a CHECK on the key the token names. */
  decrypt?: AegisDecryptKey;
};

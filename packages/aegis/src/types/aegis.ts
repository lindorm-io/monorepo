import type { AmphoraKeySelector, AmphoraQuery, IAmphora } from "@lindorm/amphora";
import type { KryptosEncryption } from "@lindorm/kryptos";
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

/**
 * Selects the signing key.
 *
 * `kryptos` is a key supplied outright — e.g. an OIDC client secret used as the
 * `HS256` MAC key for an id_token (Core §10.1). Never a vault resident, so the
 * SELECTOR (`predicate`) does not apply to it — but the profile FLOOR still
 * does, which is what makes injection safe rather than an escape hatch.
 *
 * `predicate` is which of the vault's keys. Meaningless for an injected `kryptos`.
 */
export type AegisSignKey = AmphoraKeySelector<AegisSignPredicate>;

/**
 * Selects the encryption (recipient) key. `kryptos` is a key supplied outright
 * — e.g. a client secret used as an `A128KW` wrap key.
 */
export type AegisEncKey = AmphoraKeySelector<AegisEncPredicate> & {
  /**
   * The JWE / COSE / AES content-encryption AEAD (`A256GCM`, …). This picks the
   * CIPHER, never the key — it is not a selector, which is why it sits beside
   * the shared selector rather than inside it.
   */
  encryption?: KryptosEncryption;
};

/**
 * The read side, signatures. The key is resolved from the token's own `kid`, so
 * a predicate cannot be a QUERY here — but it is exactly right as a CHECK,
 * applied to the resolved key before any signature is touched. That closes the
 * RFC 8725 §3.1 hole: without it, an attacker who can name any `kid` in the
 * vault picks the verification key's class.
 *
 * ⚠ DELIBERATELY NOT an `AmphoraKeySelector` — do not "harmonise" it with the
 * other three. It carries no `kryptos` because no verification path supplies
 * one: every key a token can be verified against is either a vault resident or
 * a JWKS key amphora already holds, and the verifier's only header input is
 * `kid`. Adding the field would create surface that nothing honours.
 *
 * (The reason is scope, NOT that a caller-supplied verification key is itself
 * unsafe — a key handed over by trusted application code is not the
 * header-embedded-key attack class, which is about trusting `jwk` / `jku` /
 * `x5u` FROM THE TOKEN. The one case that would justify the field is
 * `client_secret_jwt`: verifying a client assertion MACed with a client secret
 * that is not in the vault. That is its own slice — it needs the resolver's
 * kid-match guard on the verify path and a wired-through per-call option. Until
 * then this stays a CHECK only.)
 */
export type AegisVerifyKey = {
  predicate?: AegisSignPredicate;
};

/**
 * The read side, ciphertext. Unlike verify this IS a full selector: `kryptos`
 * is the read-side twin of `AegisEncKey.kryptos`, for ciphertext written to a
 * key that is not a vault resident — an RFC 9101 encrypted request object whose
 * `A128KW` / `dir` key is derived from a client secret, or an AES payload
 * encrypted with an injected key, which could otherwise be encrypted and never
 * decrypted again. The vault is skipped; the FLOOR is not.
 *
 * Selection here is still driven by the ciphertext's own key id, so a supplied
 * key is honoured only when it IS the key the ciphertext names. One that names
 * something else is a caller error, not a silent fallback: ciphertext can only
 * be read by the key it was written to.
 */
export type AegisDecryptKey = AmphoraKeySelector<AegisEncPredicate>;

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

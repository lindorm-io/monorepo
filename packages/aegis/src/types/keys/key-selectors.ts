import type { Condition } from "@lindorm/match";
import type { AmphoraKeySelector, AmphoraQuery } from "@lindorm/amphora";
import type { KryptosEncryption } from "@lindorm/kryptos";

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
export type AegisSignCondition = Condition<AegisKeyAttributes>;

/** Selects an encryption / decryption key. Same attributes as the sign side. */
export type AegisEncCondition = Condition<AegisKeyAttributes>;

/**
 * Selects the signing key.
 *
 * `kryptos` is a key supplied outright — e.g. an OIDC client secret used as the
 * `HS256` MAC key for an id_token (Core §10.1). Never a vault resident, so the
 * SELECTOR (`condition`) does not apply to it — but the profile FLOOR still
 * does, which is what makes injection safe rather than an escape hatch.
 *
 * `condition` is which of the vault's keys. Meaningless for an injected `kryptos`.
 */
export type AegisSignKey = AmphoraKeySelector<AegisSignCondition>;

/**
 * Selects the encryption (recipient) key. `kryptos` is a key supplied outright
 * — e.g. a client secret used as an `A128KW` wrap key.
 */
export type AegisEncKey = AmphoraKeySelector<AegisEncCondition> & {
  /**
   * The JWE / COSE / AES content-encryption AEAD (`A256GCM`, …). This picks the
   * CIPHER, never the key — it is not a selector, which is why it sits beside
   * the shared selector rather than inside it.
   */
  encryption?: KryptosEncryption;
};

/**
 * The read side, signatures. Selection is driven by the token's own `kid`, so a
 * `condition` cannot be a QUERY here — it is a CHECK, applied to the resolved
 * key before any signature is touched. That closes the RFC 8725 §3.1 hole:
 * without it, an attacker who can name any `kid` in the vault picks the
 * verification key's class.
 *
 * `kryptos` is the read-side twin of `AegisSignKey.kryptos`: a key supplied
 * outright to verify a signature made by a key that is NOT a vault resident —
 * the RFC 7523 `client_secret_jwt` assertion, MACed (`HS256`) with a client
 * secret the verifier holds out-of-band. The vault is skipped; the FLOOR is
 * not, which is what makes injection safe rather than an escape hatch.
 *
 * This is NOT the header-embedded-key attack class — that is about trusting
 * `jwk` / `jku` / `x5u` FROM THE TOKEN. A key handed over by trusted application
 * code is not token-controlled; the verifier's only header input remains `kid`,
 * used as a lookup into the vault, never as a key itself. When the token DOES
 * name a `kid`, a supplied key that names a different one is a caller error, not
 * a silent fallback (`resolveKey` throws `verify_key_mismatch`). A kid-less
 * assertion — the usual `client_secret_jwt` shape — is verified by the injected
 * key alone.
 */
export type AegisVerifyKey = AmphoraKeySelector<AegisSignCondition>;

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
export type AegisDecryptKey = AmphoraKeySelector<AegisEncCondition>;

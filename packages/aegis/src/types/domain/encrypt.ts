import type { Dict } from "@lindorm/types";
import type { TokenType } from "../../constants/token-type.js";
import type { OmitMode } from "../../internal/utils/apply-omit.js";
import type { DomainClaims } from "../../internal/utils/extract-claims.js";
import type { AegisDecryptKey, AegisEncKey } from "../keys/key-selectors.js";
import type { BindCertificateMode } from "../header/domain-header.js";
import type { WireProtectedHeader } from "../header/wire-envelope.js";

/**
 * The `aegis.encrypt` input (§5e) — the mirror of `sign`'s payload. A plain
 * object is a DOMAIN-keyed claims set (translated to the wire before it is
 * encrypted); a `Buffer`/`string` is OPAQUE and passes through untouched.
 */
export type EncryptData = (DomainClaims & Dict) | Buffer | string;

/**
 * The `aegis.encrypt` options (§5e) — the mirror of the `sign` option family,
 * scoped to the encryption surface. `aes` is a separate surface (`aegis.aes`),
 * so `format` is only `jwe`/`cwe`. Encryption is pure confidentiality: there is
 * NO inner signature (sender auth ⇒ `mint(profile, content, { encrypt })`).
 */
export type EncryptOptions = {
  /** Wire encoding — a JWE (default) or a COSE_Encrypt0 (`cwe`). */
  format?: "jwe" | "cwe";
  /** Per-call recipient key policy; its `encryption` picks the content AEAD. */
  key?: AegisEncKey;
  /** The domain token type stamped on the wire header (`typ`). */
  type?: TokenType;
  /** How empty claims are pruned before encoding; ignored for opaque data. */
  omit?: OmitMode;
  /** Caller-supplyable PROTECTED wire header fields (`oid` rides here, ruling 3). */
  header?: WireProtectedHeader;
  /**
   * ECDH-ES Agreement PartyUInfo (RFC 7518 §4.6.1.2) — the base64url producer
   * identity. Consumed by the Concat-KDF AND emitted on the protected header
   * (`apu`) ONLY when the recipient key is an ECDH-ES algorithm; supplied for any
   * other algorithm (including the `cwe` path) it is stripped (not fed to the KDF,
   * not emitted).
   */
  partyProducer?: string;
  /**
   * ECDH-ES Agreement PartyVInfo (RFC 7518 §4.6.1.3) — the base64url recipient
   * identity. Same ECDH-ES gate/strip semantics as {@link partyProducer}; on the
   * read side a decrypt configured with `partyRecipient` verifies the incoming
   * `apv` matches it.
   */
  partyRecipient?: string;
  bindCertificate?: BindCertificateMode;
  /**
   * Emit the SHA-1 certificate thumbprint (`x5t`) alongside `x5t#S256` whenever a
   * cert is bound. Default `true`. Independent of `bindCertificate`; the read side
   * never verifies SHA-1.
   */
  certificateThumbprintSha1?: boolean;
  /**
   * Allow a lindorm-proprietary (private-use) COSE content encryption on the
   * `cwe` path (default `false`, D5 interop gate); threaded to `CweKit.encrypt`.
   * A no-op on the `jwe` path.
   */
  proprietary?: boolean;
};

/**
 * The `aegis.decrypt` options (§5e). Confidentiality-only: it reuses the
 * deployment `decrypt` key policy plus this per-call CHECK/injection.
 */
export type DecryptOptions = {
  /** Per-call decryption key policy — a CHECK (plus injectable `kryptos`). */
  key?: AegisDecryptKey;
};

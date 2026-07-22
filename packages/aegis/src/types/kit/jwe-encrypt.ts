import type { TokenType } from "../../constants/token-type.js";
import type { AegisEncKey } from "../aegis.js";
import type { BindCertificateMode, TokenEncryptOrSignOptions } from "../header/header.js";

export type JweEncryptOptions = {
  bindCertificate?: BindCertificateMode;
  /**
   * Emit the SHA-1 certificate thumbprint (`x5t`) alongside `x5t#S256` whenever a
   * cert is bound. Default `true`. Independent of `bindCertificate`; the read side
   * never verifies SHA-1.
   */
  certificateThumbprintSha1?: boolean;
  header?: TokenEncryptOrSignOptions;
  /**
   * Per-call encryption (recipient) key policy. Ignored by `JweKit`, which is
   * handed an explicit key; consumed by `Aegis`, which resolves one. Its
   * `encryption` picks the content-encryption AEAD.
   */
  key?: AegisEncKey;
  objectId?: string;
  /**
   * ECDH-ES Agreement PartyUInfo (RFC 7518 §4.6.1.2) — the base64url producer
   * identity. Consumed by the Concat-KDF AND emitted on the protected header
   * (`apu`) ONLY when the recipient key is an ECDH-ES algorithm; supplied for any
   * other algorithm it is stripped (not fed to the KDF, not emitted).
   */
  partyProducer?: string;
  /**
   * ECDH-ES Agreement PartyVInfo (RFC 7518 §4.6.1.3) — the base64url recipient
   * identity. Same ECDH-ES gate/strip semantics as {@link partyProducer}; on the
   * read side a JweKit configured with `partyRecipient` verifies the incoming
   * `apv` matches it.
   */
  partyRecipient?: string;
  tokenType?: TokenType;
};

export type EncryptedJwe = {
  token: string;
};

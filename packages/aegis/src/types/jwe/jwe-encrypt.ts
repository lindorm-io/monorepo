import type { TokenType } from "../../constants/token-type.js";
import type { AegisEncKey } from "../aegis.js";
import type { BindCertificateMode, TokenEncryptOrSignOptions } from "../header.js";

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
  tokenType?: TokenType;
};

export type EncryptedJwe = {
  token: string;
};

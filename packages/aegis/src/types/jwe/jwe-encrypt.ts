import type { TokenType } from "../../constants/token-type.js";
import type { AegisEncKey } from "../aegis.js";
import type { BindCertificateMode, TokenEncryptOrSignOptions } from "../header.js";

export type JweEncryptOptions = {
  bindCertificate?: BindCertificateMode;
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

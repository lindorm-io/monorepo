import type { TokenType } from "../../constants/token-type.js";
import type { AegisSignKey } from "../aegis.js";
import type { BindCertificateMode, TokenEncryptOrSignOptions } from "../header.js";

export type SignJwsOptions = {
  bindCertificate?: BindCertificateMode;
  contentType?: string;
  header?: TokenEncryptOrSignOptions;
  objectId?: string;
  /**
   * Per-call signing key policy. Ignored by `JwsKit`, which is handed an
   * explicit key; consumed by `Aegis`, which resolves one.
   */
  sign?: AegisSignKey;
  tokenType?: TokenType;
};

export type SignedJws = {
  objectId: string | undefined;
  token: string;
};

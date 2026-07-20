import type { TokenType } from "../../constants/token-type.js";
import type { AegisSignKey } from "../aegis.js";
import type { BindCertificateMode, TokenEncryptOrSignOptions } from "../header.js";

export type SignJwsOptions = {
  bindCertificate?: BindCertificateMode;
  /**
   * Emit the SHA-1 certificate thumbprint (`x5t`) alongside the SHA-256 one
   * whenever a cert is bound. Default `true` (older-client compat). Independent
   * of `bindCertificate` — it only gates the extra `x5t` emission; the read side
   * never verifies SHA-1.
   */
  certificateThumbprintSha1?: boolean;
  contentType?: string;
  header?: TokenEncryptOrSignOptions;
  objectId?: string;
  /**
   * Per-call signing key policy. Ignored by `JwsKit`, which is handed an
   * explicit key; consumed by `Aegis`, which resolves one.
   */
  key?: AegisSignKey;
  tokenType?: TokenType;
};

export type SignedJws = {
  objectId: string | undefined;
  token: string;
};

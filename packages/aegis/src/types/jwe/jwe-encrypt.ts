import type { TokenType } from "../../constants/token-type.js";
import type { BindCertificateMode, TokenEncryptOrSignOptions } from "../header.js";

export type JweEncryptOptions = {
  bindCertificate?: BindCertificateMode;
  header?: TokenEncryptOrSignOptions;
  objectId?: string;
  tokenType?: TokenType;
};

export type EncryptedJwe = {
  token: string;
};

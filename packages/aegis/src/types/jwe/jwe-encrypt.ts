import { TokenType } from "../../constants/token-type";
import { BindCertificateMode, TokenEncryptOrSignOptions } from "../header";

export type JweEncryptOptions = {
  bindCertificate?: BindCertificateMode;
  header?: TokenEncryptOrSignOptions;
  objectId?: string;
  tokenType?: TokenType;
};

export type EncryptedJwe = {
  token: string;
};

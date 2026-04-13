import { TokenType } from "../../constants/token-type";
import { BindCertificateMode, TokenEncryptOrSignOptions } from "../header";

export type SignJwsOptions = {
  bindCertificate?: BindCertificateMode;
  contentType?: string;
  header?: TokenEncryptOrSignOptions;
  objectId?: string;
  tokenType?: TokenType;
};

export type SignedJws = {
  objectId: string | undefined;
  token: string;
};

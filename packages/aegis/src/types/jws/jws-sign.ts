import { TokenType } from "../../constants/token-type";
import { TokenEncryptOrSignOptions } from "../header";

export type SignJwsOptions = {
  contentType?: string;
  header?: TokenEncryptOrSignOptions;
  objectId?: string;
  tokenType?: TokenType;
};

export type SignedJws = {
  objectId: string | undefined;
  token: string;
};

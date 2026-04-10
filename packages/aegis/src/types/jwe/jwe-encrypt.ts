import { TokenType } from "../../constants/token-type";
import { TokenEncryptOrSignOptions } from "../header";

export type JweEncryptOptions = {
  header?: TokenEncryptOrSignOptions;
  objectId?: string;
  tokenType?: TokenType;
};

export type EncryptedJwe = {
  token: string;
};

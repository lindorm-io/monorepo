import { TokenType } from "../../constants/token-type";
import { CoseTarget } from "../cose-target";
import { TokenEncryptOrSignOptions } from "../header";

export type CweEncryptOptions = {
  header?: TokenEncryptOrSignOptions;
  objectId?: string;
  target?: CoseTarget;
  tokenType?: TokenType;
};

export type EncryptedCwe = {
  buffer: Buffer;
  token: string;
};

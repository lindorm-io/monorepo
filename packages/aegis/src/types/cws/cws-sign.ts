import { TokenType } from "../../constants/token-type";
import { CoseTarget } from "../cose-target";
import { TokenEncryptOrSignOptions } from "../header";

export type SignCwsOptions = {
  contentType?: string;
  header?: TokenEncryptOrSignOptions;
  objectId?: string;
  target?: CoseTarget;
  tokenType?: TokenType;
};

export type SignedCws = {
  buffer: Buffer;
  objectId: string;
  token: string;
};

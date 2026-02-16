import { CoseTarget } from "../cose-target";
import { TokenEncryptOrSignOptions } from "../header";

export type CweEncryptOptions = {
  header?: TokenEncryptOrSignOptions;
  objectId?: string;
  target?: CoseTarget;
};

export type EncryptedCwe = {
  buffer: Buffer;
  token: string;
};

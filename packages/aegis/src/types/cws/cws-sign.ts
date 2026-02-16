import { CoseTarget } from "../cose-target";
import { TokenEncryptOrSignOptions } from "../header";

export type SignCwsOptions = {
  contentType?: string;
  header?: TokenEncryptOrSignOptions;
  objectId?: string;
  target?: CoseTarget;
};

export type SignedCws = {
  buffer: Buffer;
  objectId: string;
  token: string;
};

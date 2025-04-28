import { TokenEncryptOrSignOptions } from "../header";

export type SignCwsOptions = {
  contentType?: string;
  header?: TokenEncryptOrSignOptions;
  objectId?: string;
};

export type SignedCws = {
  buffer: Buffer;
  objectId: string;
  token: string;
};

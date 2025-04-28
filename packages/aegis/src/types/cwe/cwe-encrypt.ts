import { TokenEncryptOrSignOptions } from "../header";

export type CweEncryptOptions = {
  header?: TokenEncryptOrSignOptions;
  objectId?: string;
};

export type EncryptedCwe = {
  buffer: Buffer;
  token: string;
};

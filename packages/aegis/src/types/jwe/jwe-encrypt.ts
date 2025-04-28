import { TokenEncryptOrSignOptions } from "../header";

export type JweEncryptOptions = {
  header?: TokenEncryptOrSignOptions;
  objectId?: string;
};

export type EncryptedJwe = {
  token: string;
};

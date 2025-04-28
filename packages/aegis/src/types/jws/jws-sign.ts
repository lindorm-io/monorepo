import { TokenEncryptOrSignOptions } from "../header";

export type SignJwsOptions = {
  contentType?: string;
  header?: TokenEncryptOrSignOptions;
  objectId?: string;
};

export type SignedJws = {
  objectId: string;
  token: string;
};

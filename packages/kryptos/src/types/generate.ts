import { KryptosOptions } from "./kryptos";
import { OctKeySize } from "./oct";
import { RsaModulusSize } from "./rsa";

export type GenerateOptions = Omit<KryptosOptions, "privateKey" | "publicKey"> & {
  modulus?: RsaModulusSize;
  size?: OctKeySize;
};

export type GenerateResult = {
  privateKey: Buffer;
  publicKey?: Buffer;
};

import { IKryptos } from "@lindorm/kryptos";
import { EncryptAesDataOptions } from "./aes-data";

export type EncryptAesCipherOptions = EncryptAesDataOptions;

export type DecryptAesCipherOptions = {
  cipher: string;
  kryptos: IKryptos;
};

export type VerifyAesCipherOptions = DecryptAesCipherOptions & {
  data: string;
};

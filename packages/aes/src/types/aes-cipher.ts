import { Kryptos } from "@lindorm/kryptos";
import { EncryptAesDataOptions } from "./aes-data";

export type EncryptAesCipherOptions = EncryptAesDataOptions;

export type DecryptAesCipherOptions = {
  cipher: string;
  kryptos: Kryptos;
};

export type VerifyAesCipherOptions = DecryptAesCipherOptions & {
  data: string;
};

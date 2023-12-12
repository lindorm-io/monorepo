import { AesAlgorithm, AesFormat } from "../enums";
import { AesCipherKey } from "./aes-cipher";

export type AesCipherOptions = {
  algorithm?: AesAlgorithm;
  format?: AesFormat;
  key?: AesCipherKey;
  secret?: string;
};

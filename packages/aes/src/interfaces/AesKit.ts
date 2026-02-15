import { IKryptos } from "@lindorm/kryptos";
import {
  AesContent,
  AesDecryptionRecord,
  AesEncryptionRecord,
  SerialisedAesDecryption,
  SerialisedAesEncryption,
} from "../types";

export type AesOperationOptions = {
  aad?: Buffer;
};

export interface IAesKit {
  kryptos: IKryptos;

  encrypt(content: AesContent, mode?: "encoded", options?: AesOperationOptions): string;
  encrypt(
    content: AesContent,
    mode: "record",
    options?: AesOperationOptions,
  ): AesEncryptionRecord;
  encrypt(
    content: AesContent,
    mode: "serialised",
    options?: AesOperationOptions,
  ): SerialisedAesEncryption;
  encrypt(content: AesContent, mode: "tokenised", options?: AesOperationOptions): string;

  decrypt<T extends AesContent = string>(
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
    options?: AesOperationOptions,
  ): T;
  verify(
    input: AesContent,
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
    options?: AesOperationOptions,
  ): boolean;
  assert(
    input: AesContent,
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
    options?: AesOperationOptions,
  ): void;
}

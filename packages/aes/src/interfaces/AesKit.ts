import { IKryptos } from "@lindorm/kryptos";
import {
  AesContent,
  AesDecryptionRecord,
  AesEncryptionRecord,
  SerialisedAesDecryption,
  SerialisedAesEncryption,
} from "../types";

export interface IAesKit {
  kryptos: IKryptos;

  encrypt(content: AesContent, mode?: "encoded"): string;
  encrypt(content: AesContent, mode: "record"): AesEncryptionRecord;
  encrypt(content: AesContent, mode: "serialised"): SerialisedAesEncryption;
  encrypt(content: AesContent, mode: "tokenised"): string;

  decrypt<T extends AesContent = string>(
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
  ): T;
  verify(
    input: string,
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
  ): boolean;
  assert(
    input: string,
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
  ): void;
}

import { IKryptos } from "@lindorm/kryptos";
import {
  AesDecryptionRecord,
  AesEncryptionRecord,
  SerialisedAesDecryption,
  SerialisedAesEncryption,
} from "../types";

export interface IAesKit {
  kryptos: IKryptos;

  encrypt(data: string, mode?: "encoded"): string;
  encrypt(data: string, mode: "record"): AesEncryptionRecord;
  encrypt(data: string, mode: "serialised"): SerialisedAesEncryption;
  encrypt(data: string, mode: "tokenised"): string;

  decrypt(data: AesDecryptionRecord | SerialisedAesDecryption | string): string;
  verify(
    input: string,
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
  ): boolean;
  assert(
    input: string,
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
  ): void;
}

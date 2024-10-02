import { IKryptos } from "@lindorm/kryptos";
import {
  AesEncryptionData,
  AesEncryptionDataEncoded,
  DecryptAesDataEncodedOptions,
  DecryptAesDataOptions,
} from "../types";

export interface IAesKit {
  kryptos: IKryptos;

  encrypt(data: string, mode?: "cipher"): string;
  encrypt(data: string, mode: "b64"): AesEncryptionDataEncoded;
  encrypt(data: string, mode: "object"): AesEncryptionData;

  decrypt(data: string): string;
  decrypt(data: Omit<DecryptAesDataOptions, "kryptos">): string;
  decrypt(data: Omit<DecryptAesDataEncodedOptions, "kryptos">): string;

  verify(data: string, cipher: string): boolean;
  assert(data: string, cipher: string): void;
}

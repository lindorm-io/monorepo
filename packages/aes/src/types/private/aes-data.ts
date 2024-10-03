import { IKryptos } from "@lindorm/kryptos";
import {
  AesDecryptionRecord,
  AesEncryptionOptions,
  SerialisedAesDecryption,
} from "../aes-data";

export type PrivateAesEncryptionOptions = AesEncryptionOptions & { kryptos: IKryptos };

export type PrivateAesDecryptionOptions = AesDecryptionRecord & { kryptos: IKryptos };

export type PrivateSerialisedAesDecryptionOptions = SerialisedAesDecryption & {
  kryptos: IKryptos;
};

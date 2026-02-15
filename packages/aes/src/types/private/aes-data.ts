import { IKryptos } from "@lindorm/kryptos";
import {
  AesDecryptionRecord,
  AesEncryptionOptions,
  SerialisedAesDecryption,
} from "../aes-decryption-data";

export type PrivateAesEncryptionOptions = AesEncryptionOptions & { kryptos: IKryptos };

export type PrivateAesDecryptionOptions = AesDecryptionRecord & {
  aad?: Buffer;
  kryptos: IKryptos;
};

export type PrivateSerialisedAesDecryptionOptions = SerialisedAesDecryption & {
  kryptos: IKryptos;
};

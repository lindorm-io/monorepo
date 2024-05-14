import { Kryptos } from "@lindorm/kryptos";
import { AesEncryption } from "../../../types";
import { _generateEncryptionKey } from "./generate-encryption-key";
import { _createPublicEncryptionKey, _decryptPublicEncryptionKey } from "./public-encryption-key";

type EncryptOptions = {
  encryption: AesEncryption;
  kryptos: Kryptos;
};

type EncryptResult = {
  encryptionKey: Buffer;
  publicEncryptionKey: Buffer;
};

type DecryptOptions = {
  kryptos: Kryptos;
  publicEncryptionKey: Buffer;
};

export const _getRsaEncryptionKeys = ({ encryption, kryptos }: EncryptOptions): EncryptResult => {
  const encryptionKey = _generateEncryptionKey(encryption);
  const publicEncryptionKey = _createPublicEncryptionKey({ encryptionKey, kryptos });

  return { encryptionKey, publicEncryptionKey };
};

export const _getRsaDecryptionKey = ({ kryptos, publicEncryptionKey }: DecryptOptions): Buffer =>
  _decryptPublicEncryptionKey({ publicEncryptionKey, kryptos });

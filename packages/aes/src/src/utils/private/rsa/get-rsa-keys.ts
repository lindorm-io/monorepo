import { Kryptos } from "@lindorm/kryptos";
import { Encryption, EncryptionKeyAlgorithm } from "../../../types";
import { _generateEncryptionKey } from "./generate-encryption-key";
import { _createPublicEncryptionKey, _decryptPublicEncryptionKey } from "./public-encryption-key";

type EncryptOptions = {
  encryption: Encryption;
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  kryptos: Kryptos;
};

type EncryptResult = {
  encryptionKey: Buffer;
  publicEncryptionKey: Buffer;
};

type DecryptOptions = {
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  kryptos: Kryptos;
  publicEncryptionKey: Buffer;
};

export const _getRsaEncryptionKeys = ({
  encryption,
  encryptionKeyAlgorithm,
  kryptos,
}: EncryptOptions): EncryptResult => {
  const encryptionKey = _generateEncryptionKey(encryption);
  const publicEncryptionKey = _createPublicEncryptionKey({
    encryptionKey,
    kryptos,
    encryptionKeyAlgorithm,
  });

  return { encryptionKey, publicEncryptionKey };
};

export const _getRsaDecryptionKey = ({
  encryptionKeyAlgorithm,
  kryptos,
  publicEncryptionKey,
}: DecryptOptions): Buffer =>
  _decryptPublicEncryptionKey({
    encryptionKeyAlgorithm,
    kryptos,
    publicEncryptionKey,
  });

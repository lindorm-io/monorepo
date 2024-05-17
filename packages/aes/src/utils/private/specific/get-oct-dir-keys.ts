import { IKryptosOct } from "@lindorm/kryptos";
import { AesEncryption } from "../../../types";
import { _calculateEncryptionKeyLength } from "./calculate-encryption-key-length";
import { _hkdf } from "./hkdf";

type EncryptOptions = {
  encryption: AesEncryption;
  kryptos: IKryptosOct;
};

type EncryptResult = {
  contentEncryptionKey: Buffer;
  salt: Buffer;
};

type DecryptOptions = {
  encryption: AesEncryption;
  kryptos: IKryptosOct;
  salt: Buffer;
};

export const _getOctDirEncryptionKey = ({
  encryption,
  kryptos,
}: EncryptOptions): EncryptResult => {
  const der = kryptos.export("der");

  const keyLength = _calculateEncryptionKeyLength(encryption);

  const { derivedKey, salt } = _hkdf({
    derivationKey: der.privateKey,
    keyLength,
  });

  return { contentEncryptionKey: derivedKey, salt };
};

export const _getOctDirDecryptionKey = ({
  encryption,
  kryptos,
  salt,
}: DecryptOptions): Buffer => {
  const der = kryptos.export("der");

  const keyLength = _calculateEncryptionKeyLength(encryption);

  const { derivedKey } = _hkdf({
    derivationKey: der.privateKey,
    keyLength,
    salt,
  });

  return derivedKey;
};

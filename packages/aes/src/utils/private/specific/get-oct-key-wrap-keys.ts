import { IKryptosOct } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { AesEncryption } from "../../../types";
import { _calculateEncryptionKeyLength } from "./calculate-encryption-key-length";
import { _hkdf } from "./hkdf";
import { _aesKeyUnwrap, _aesKeyWrap } from "./key-wrap";

type EncryptOptions = {
  encryption: AesEncryption;
  kryptos: IKryptosOct;
};

type EncryptResult = {
  contentEncryptionKey: Buffer;
  publicEncryptionKey: Buffer;
  salt: Buffer;
};

type DecryptOptions = {
  encryption: AesEncryption;
  kryptos: IKryptosOct;
  publicEncryptionKey: Buffer;
  salt: Buffer;
};

export const _getOctKeyWrapEncryptionKey = ({
  encryption,
  kryptos,
}: EncryptOptions): EncryptResult => {
  const der = kryptos.export("der");

  const keyLength = _calculateEncryptionKeyLength(encryption);
  const contentEncryptionKey = randomBytes(keyLength);

  const { derivedKey, salt } = _hkdf({
    derivationKey: der.privateKey,
    keyLength,
  });

  const publicEncryptionKey = _aesKeyWrap({
    contentEncryptionKey,
    kryptos,
    keyEncryptionKey: derivedKey,
  });

  return { contentEncryptionKey, publicEncryptionKey, salt };
};

export const _getOctKeyWrapDecryptionKey = ({
  encryption,
  kryptos,
  publicEncryptionKey,
  salt,
}: DecryptOptions): Buffer => {
  const der = kryptos.export("der");

  const keyLength = _calculateEncryptionKeyLength(encryption);

  const { derivedKey } = _hkdf({
    derivationKey: der.privateKey,
    keyLength,
    salt,
  });

  const unwrappedKey = _aesKeyUnwrap({
    keyEncryptionKey: derivedKey,
    kryptos,
    wrappedKey: publicEncryptionKey,
  });

  return unwrappedKey;
};

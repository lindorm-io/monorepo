import { IKryptos } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { AesEncryption, PublicEncryptionJwk } from "../../../types";
import { _calculateEncryptionKeyLength } from "./calculate-encryption-key-length";
import { _hkdf } from "./hkdf";
import { _aesKeyUnwrap, _aesKeyWrap } from "./key-wrap";
import { _calculateSharedSecret, _generateSharedSecret } from "./shared-secret";

type EncryptOptions = {
  encryption: AesEncryption;
  kryptos: IKryptos;
};

type EncryptResult = {
  contentEncryptionKey: Buffer;
  publicEncryptionJwk: PublicEncryptionJwk;
  publicEncryptionKey: Buffer;
  salt: Buffer;
};

type DecryptOptions = {
  encryption: AesEncryption;
  kryptos: IKryptos;
  publicEncryptionJwk: PublicEncryptionJwk;
  publicEncryptionKey: Buffer;
  salt: Buffer;
};

export const _getDiffieHellmanKeyWrapEncryptionKey = ({
  encryption,
  kryptos,
}: EncryptOptions): EncryptResult => {
  const { publicEncryptionJwk, sharedSecret } = _generateSharedSecret(kryptos);

  const keyLength = _calculateEncryptionKeyLength(encryption);
  const contentEncryptionKey = randomBytes(keyLength);

  const { derivedKey, salt } = _hkdf({
    derivationKey: sharedSecret,
    keyLength,
  });

  const publicEncryptionKey = _aesKeyWrap({
    contentEncryptionKey,
    kryptos,
    keyEncryptionKey: derivedKey,
  });

  return {
    contentEncryptionKey,
    publicEncryptionJwk,
    publicEncryptionKey,
    salt,
  };
};

export const _getDiffieHellmanKeyWrapDecryptionKey = ({
  encryption,
  kryptos,
  publicEncryptionJwk,
  publicEncryptionKey,
  salt,
}: DecryptOptions): Buffer => {
  const sharedSecret = _calculateSharedSecret({ kryptos, publicEncryptionJwk });

  const keyLength = _calculateEncryptionKeyLength(encryption);

  const { derivedKey } = _hkdf({
    derivationKey: sharedSecret,
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

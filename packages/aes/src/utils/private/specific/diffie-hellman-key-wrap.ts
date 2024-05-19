import { randomBytes } from "crypto";
import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import { _calculateEncryptionKeyLength } from "./calculate-encryption-key-length";
import { _hkdf } from "./hkdf";
import { _aesKeyUnwrap, _aesKeyWrap } from "./key-wrap";
import { _calculateSharedSecret, _generateSharedSecret } from "./shared-secret";

export const _getDiffieHellmanKeyWrapEncryptionKey = ({
  encryption,
  kryptos,
}: CreateCekOptions): CreateCekResult => {
  const { publicEncryptionJwk, sharedSecret } = _generateSharedSecret(kryptos);

  const keyLength = _calculateEncryptionKeyLength(encryption);
  const contentEncryptionKey = randomBytes(keyLength);

  const { derivedKey, hkdfSalt } = _hkdf({
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
    hkdfSalt,
    publicEncryptionJwk,
    publicEncryptionKey,
  };
};

export const _getDiffieHellmanKeyWrapDecryptionKey = ({
  encryption,
  hkdfSalt,
  kryptos,
  publicEncryptionJwk,
  publicEncryptionKey,
}: DecryptCekOptions): DecryptCekResult => {
  if (!publicEncryptionKey) {
    throw new AesError("Missing publicEncryptionKey");
  }

  const sharedSecret = _calculateSharedSecret({ kryptos, publicEncryptionJwk });

  const keyLength = _calculateEncryptionKeyLength(encryption);

  const { derivedKey } = _hkdf({
    derivationKey: sharedSecret,
    hkdfSalt,
    keyLength,
  });

  const unwrappedKey = _aesKeyUnwrap({
    keyEncryptionKey: derivedKey,
    kryptos,
    wrappedKey: publicEncryptionKey,
  });

  return { contentEncryptionKey: unwrappedKey };
};

import { randomBytes } from "crypto";
import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import { _calculateContentEncryptionKeySize } from "../calculate/calculate-content-encryption-key-size";
import { _calculateKeyWrapSize } from "../calculate/calculate-key-wrap-size";
import { _hkdf } from "../key-derivation/hkdf";
import { _aesKeyUnwrap, _aesKeyWrap } from "../key-wrap/key-wrap";
import { _calculateSharedSecret, _generateSharedSecret } from "./shared-secret";

export const _getDiffieHellmanKeyWrapEncryptionKey = ({
  encryption,
  kryptos,
}: CreateCekOptions): CreateCekResult => {
  const { publicEncryptionJwk, sharedSecret } = _generateSharedSecret(kryptos);

  const cekSize = _calculateContentEncryptionKeySize(encryption);
  const contentEncryptionKey = randomBytes(cekSize);

  const { derivedKey, hkdfSalt } = _hkdf({
    derivationKey: sharedSecret,
    keyLength: _calculateKeyWrapSize(kryptos.algorithm),
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
  hkdfSalt,
  kryptos,
  publicEncryptionJwk,
  publicEncryptionKey,
}: DecryptCekOptions): DecryptCekResult => {
  if (!publicEncryptionKey) {
    throw new AesError("Missing publicEncryptionKey");
  }

  const sharedSecret = _calculateSharedSecret({ kryptos, publicEncryptionJwk });

  const { derivedKey } = _hkdf({
    derivationKey: sharedSecret,
    hkdfSalt,
    keyLength: _calculateKeyWrapSize(kryptos.algorithm),
  });

  const unwrappedKey = _aesKeyUnwrap({
    keyEncryptionKey: derivedKey,
    kryptos,
    wrappedKey: publicEncryptionKey,
  });

  return { contentEncryptionKey: unwrappedKey };
};

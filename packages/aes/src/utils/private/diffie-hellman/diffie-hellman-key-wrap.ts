import { randomBytes } from "crypto";
import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import { calculateContentEncryptionKeySize, calculateKeyWrapSize } from "../calculate";
import { hkdf } from "../key-derivation";
import { keyUnwrap, keyWrap } from "../key-wrap";
import { calculateSharedSecret, generateSharedSecret } from "./shared-secret";

export const getDiffieHellmanKeyWrapEncryptionKey = ({
  encryption,
  kryptos,
}: CreateCekOptions): CreateCekResult => {
  const { publicEncryptionJwk, sharedSecret } = generateSharedSecret(kryptos);

  const cekSize = calculateContentEncryptionKeySize(encryption);
  const contentEncryptionKey = randomBytes(cekSize);

  const { derivedKey, hkdfSalt } = hkdf({
    derivationKey: sharedSecret,
    keyLength: calculateKeyWrapSize(kryptos.algorithm),
  });

  const { publicEncryptionKey, publicEncryptionIv, publicEncryptionTag } = keyWrap({
    contentEncryptionKey,
    kryptos,
    keyEncryptionKey: derivedKey,
  });

  return {
    contentEncryptionKey,
    hkdfSalt,
    publicEncryptionJwk,
    publicEncryptionKey,
    publicEncryptionIv,
    publicEncryptionTag,
  };
};

export const getDiffieHellmanKeyWrapDecryptionKey = ({
  hkdfSalt,
  kryptos,
  publicEncryptionJwk,
  publicEncryptionIv,
  publicEncryptionKey,
  publicEncryptionTag,
}: DecryptCekOptions): DecryptCekResult => {
  if (!publicEncryptionKey) {
    throw new AesError("Missing publicEncryptionKey");
  }

  const sharedSecret = calculateSharedSecret({ kryptos, publicEncryptionJwk });

  const { derivedKey } = hkdf({
    derivationKey: sharedSecret,
    hkdfSalt,
    keyLength: calculateKeyWrapSize(kryptos.algorithm),
  });

  return keyUnwrap({
    keyEncryptionKey: derivedKey,
    kryptos,
    publicEncryptionIv,
    publicEncryptionKey,
    publicEncryptionTag,
  });
};

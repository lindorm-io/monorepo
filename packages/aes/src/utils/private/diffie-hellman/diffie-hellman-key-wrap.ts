import { randomBytes } from "crypto";
import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import { calculateContentEncryptionKeySize, calculateKeyWrapSize } from "../calculate";
import { concatKdf } from "../key-derivation";
import { keyUnwrap, keyWrap } from "../key-wrap";
import { calculateSharedSecret, generateSharedSecret } from "./shared-secret";

export const getDiffieHellmanKeyWrapEncryptionKey = ({
  apu,
  apv,
  encryption,
  kryptos,
}: CreateCekOptions): CreateCekResult => {
  const { publicEncryptionJwk, sharedSecret } = generateSharedSecret(kryptos);

  const cekSize = calculateContentEncryptionKeySize(encryption);
  const contentEncryptionKey = randomBytes(cekSize);

  const { derivedKey } = concatKdf({
    algorithm: kryptos.algorithm,
    apu,
    apv,
    keyLength: calculateKeyWrapSize(kryptos.algorithm),
    sharedSecret,
  });

  const { publicEncryptionKey, publicEncryptionIv, publicEncryptionTag } = keyWrap({
    contentEncryptionKey,
    kryptos,
    keyEncryptionKey: derivedKey,
  });

  return {
    contentEncryptionKey,
    hkdfSalt: undefined,
    publicEncryptionJwk,
    publicEncryptionKey,
    publicEncryptionIv,
    publicEncryptionTag,
  };
};

export const getDiffieHellmanKeyWrapDecryptionKey = ({
  apu,
  apv,
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

  const { derivedKey } = concatKdf({
    algorithm: kryptos.algorithm,
    apu,
    apv,
    keyLength: calculateKeyWrapSize(kryptos.algorithm),
    sharedSecret,
  });

  return keyUnwrap({
    keyEncryptionKey: derivedKey,
    kryptos,
    publicEncryptionIv,
    publicEncryptionKey,
    publicEncryptionTag,
  });
};

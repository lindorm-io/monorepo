import { randomBytes } from "crypto";
import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../types/content-encryption-key";
import { calculateContentEncryptionKeySize } from "../calculate/calculate-content-encryption-key-size";
import { calculateKeyWrapSize } from "../calculate/calculate-key-wrap-size";
import { concatKdf } from "../key-derivation/concat-kdf";
import { keyUnwrap, keyWrap } from "../key-wrap/key-wrap";
import { calculateSharedSecret, generateSharedSecret } from "./shared-secret";

export const getDiffieHellmanKeyWrapEncryptionKey = ({
  encryption,
  kryptos,
}: CreateCekOptions): CreateCekResult => {
  const { publicEncryptionJwk, sharedSecret } = generateSharedSecret(kryptos);

  const cekSize = calculateContentEncryptionKeySize(encryption);
  const contentEncryptionKey = randomBytes(cekSize);

  const { derivedKey } = concatKdf({
    algorithm: kryptos.algorithm,
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
    publicEncryptionJwk,
    publicEncryptionKey,
    publicEncryptionIv,
    publicEncryptionTag,
  };
};

export const getDiffieHellmanKeyWrapDecryptionKey = ({
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

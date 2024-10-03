import { Kryptos } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import { calculateContentEncryptionKeySize } from "../calculate";
import { hkdf } from "../key-derivation";
import { calculateSharedSecret, generateSharedSecret } from "./shared-secret";

export const getDiffieHellmanEncryptionKey = ({
  encryption,
  kryptos,
}: CreateCekOptions): CreateCekResult => {
  const { publicEncryptionJwk, sharedSecret } = generateSharedSecret(kryptos);
  const keyLength = calculateContentEncryptionKeySize(encryption);

  const { derivedKey, hkdfSalt } = hkdf({
    derivationKey: sharedSecret,
    keyLength,
  });

  return {
    contentEncryptionKey: derivedKey,
    hkdfSalt,
    publicEncryptionJwk,
  };
};

export const getDiffieHellmanDecryptionKey = ({
  encryption,
  hkdfSalt,
  kryptos,
  publicEncryptionJwk,
}: DecryptCekOptions): DecryptCekResult => {
  if (!Kryptos.isEc(kryptos) && !Kryptos.isOkp(kryptos)) {
    throw new AesError("Invalid kryptos type");
  }
  if (!publicEncryptionJwk) {
    throw new AesError("Missing publicEncryptionJwk");
  }

  const sharedSecret = calculateSharedSecret({ kryptos, publicEncryptionJwk });
  const keyLength = calculateContentEncryptionKeySize(encryption);

  const { derivedKey } = hkdf({
    derivationKey: sharedSecret,
    hkdfSalt,
    keyLength,
  });

  return { contentEncryptionKey: derivedKey };
};

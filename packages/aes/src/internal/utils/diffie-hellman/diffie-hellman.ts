import { KryptosKit } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "#internal/types/content-encryption-key";
import { calculateContentEncryptionKeySize } from "#internal/utils/calculate/calculate-content-encryption-key-size";
import { concatKdf } from "#internal/utils/key-derivation/concat-kdf";
import { calculateSharedSecret, generateSharedSecret } from "./shared-secret";

export const getDiffieHellmanEncryptionKey = ({
  apu,
  apv,
  encryption,
  kryptos,
}: CreateCekOptions): CreateCekResult => {
  const { publicEncryptionJwk, sharedSecret } = generateSharedSecret(kryptos);
  const keyLength = calculateContentEncryptionKeySize(encryption);

  const { derivedKey } = concatKdf({
    algorithm: encryption,
    apu,
    apv,
    keyLength,
    sharedSecret,
  });

  return {
    contentEncryptionKey: derivedKey,
    publicEncryptionJwk,
  };
};

export const getDiffieHellmanDecryptionKey = ({
  apu,
  apv,
  encryption,
  kryptos,
  publicEncryptionJwk,
}: DecryptCekOptions): DecryptCekResult => {
  if (!KryptosKit.isEc(kryptos) && !KryptosKit.isOkp(kryptos)) {
    throw new AesError("Invalid kryptos type");
  }
  if (!publicEncryptionJwk) {
    throw new AesError("Missing publicEncryptionJwk");
  }

  const sharedSecret = calculateSharedSecret({ kryptos, publicEncryptionJwk });
  const keyLength = calculateContentEncryptionKeySize(encryption);

  const { derivedKey } = concatKdf({
    algorithm: encryption,
    apu,
    apv,
    keyLength,
    sharedSecret,
  });

  return { contentEncryptionKey: derivedKey };
};

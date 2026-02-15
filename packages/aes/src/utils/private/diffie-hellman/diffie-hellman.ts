import { KryptosKit } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import { calculateContentEncryptionKeySize } from "../calculate";
import { concatKdf } from "../key-derivation";
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

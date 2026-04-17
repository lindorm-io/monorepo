import { KryptosKit } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../types/content-encryption-key";
import { calculateContentEncryptionKeySize } from "../calculate/calculate-content-encryption-key-size";
import { concatKdf } from "../key-derivation/concat-kdf";
import { calculateSharedSecret, generateSharedSecret } from "./shared-secret";

export const getDiffieHellmanEncryptionKey = ({
  encryption,
  kryptos,
}: CreateCekOptions): CreateCekResult => {
  const { publicEncryptionJwk, sharedSecret } = generateSharedSecret(kryptos);
  const keyLength = calculateContentEncryptionKeySize(encryption);

  const { derivedKey } = concatKdf({
    algorithm: encryption,
    keyLength,
    sharedSecret,
  });

  return {
    contentEncryptionKey: derivedKey,
    publicEncryptionJwk,
  };
};

export const getDiffieHellmanDecryptionKey = ({
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
    keyLength,
    sharedSecret,
  });

  return { contentEncryptionKey: derivedKey };
};

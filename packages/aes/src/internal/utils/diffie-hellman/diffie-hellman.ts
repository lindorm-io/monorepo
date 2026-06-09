import { KryptosKit } from "@lindorm/kryptos";
import { AesError } from "../../../errors/index.js";
import type {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../types/content-encryption-key.js";
import { calculateContentEncryptionKeySize } from "../calculate/calculate-content-encryption-key-size.js";
import { concatKdf } from "../key-derivation/concat-kdf.js";
import { calculateSharedSecret, generateSharedSecret } from "./shared-secret.js";

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
    throw new AesError("Invalid kryptos type", {
      code: "invalid_kryptos_type",
      title: "Invalid Kryptos Type",
      details: "ECDH-ES decryption requires an EC or OKP Kryptos key type.",
    });
  }
  if (!publicEncryptionJwk) {
    throw new AesError("Missing publicEncryptionJwk", {
      code: "missing_public_encryption_jwk",
      title: "Missing Public Encryption JWK",
      details:
        "ECDH-ES decryption requires the sender's ephemeral public JWK, but it was not provided.",
    });
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

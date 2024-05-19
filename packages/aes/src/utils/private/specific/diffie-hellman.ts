import { Kryptos } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import { _calculateEncryptionKeyLength } from "./calculate-encryption-key-length";
import { _hkdf } from "./hkdf";
import { _calculateSharedSecret, _generateSharedSecret } from "./shared-secret";

export const _getDiffieHellmanEncryptionKey = ({
  encryption,
  kryptos,
}: CreateCekOptions): CreateCekResult => {
  const { publicEncryptionJwk, sharedSecret } = _generateSharedSecret(kryptos);
  const keyLength = _calculateEncryptionKeyLength(encryption);

  const { derivedKey, hkdfSalt } = _hkdf({
    derivationKey: sharedSecret,
    keyLength,
  });

  return {
    contentEncryptionKey: derivedKey,
    hkdfSalt,
    publicEncryptionJwk,
  };
};

export const _getDiffieHellmanDecryptionKey = ({
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

  const sharedSecret = _calculateSharedSecret({ kryptos, publicEncryptionJwk });
  const keyLength = _calculateEncryptionKeyLength(encryption);

  const { derivedKey } = _hkdf({
    derivationKey: sharedSecret,
    hkdfSalt,
    keyLength,
  });

  return { contentEncryptionKey: derivedKey };
};

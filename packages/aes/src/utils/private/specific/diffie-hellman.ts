import { IKryptos } from "@lindorm/kryptos";
import { AesEncryption, PublicEncryptionJwk } from "../../../types";
import { _calculateEncryptionKeyLength } from "./calculate-encryption-key-length";
import { _hkdf } from "./hkdf";
import { _calculateSharedSecret, _generateSharedSecret } from "./shared-secret";

type EncryptOptions = {
  encryption: AesEncryption;
  kryptos: IKryptos;
};

type EncryptResult = {
  contentEncryptionKey: Buffer;
  publicEncryptionJwk: PublicEncryptionJwk;
  salt: Buffer;
};

type DecryptOptions = {
  encryption: AesEncryption;
  kryptos: IKryptos;
  publicEncryptionJwk: PublicEncryptionJwk;
  salt: Buffer;
};

export const _getDiffieHellmanEncryptionKey = ({
  encryption,
  kryptos,
}: EncryptOptions): EncryptResult => {
  const { publicEncryptionJwk, sharedSecret } = _generateSharedSecret(kryptos);

  const keyLength = _calculateEncryptionKeyLength(encryption);

  const { derivedKey, salt } = _hkdf({
    derivationKey: sharedSecret,
    keyLength,
  });

  return {
    contentEncryptionKey: derivedKey,
    publicEncryptionJwk,
    salt,
  };
};

export const _getDiffieHellmanDecryptionKey = ({
  encryption,
  kryptos,
  publicEncryptionJwk,
  salt,
}: DecryptOptions): Buffer => {
  const sharedSecret = _calculateSharedSecret({ kryptos, publicEncryptionJwk });

  const keyLength = _calculateEncryptionKeyLength(encryption);

  const { derivedKey } = _hkdf({
    derivationKey: sharedSecret,
    keyLength,
    salt,
  });

  return derivedKey;
};

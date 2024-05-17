import { IKryptos, Kryptos } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import { AesEncryption, PublicEncryptionJwk } from "../../../types";
import {
  _getDiffieHellmanDecryptionKey,
  _getDiffieHellmanEncryptionKey,
} from "../specific/diffie-hellman";
import {
  _getDiffieHellmanKeyWrapDecryptionKey,
  _getDiffieHellmanKeyWrapEncryptionKey,
} from "../specific/diffie-hellman-key-wrap";

type EncryptOptions = {
  encryption: AesEncryption;
  kryptos: IKryptos;
};

type EncryptResult = {
  contentEncryptionKey: Buffer;
  publicEncryptionJwk: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
  salt: Buffer;
};

type DecryptOptions = {
  encryption: AesEncryption;
  kryptos: IKryptos;
  publicEncryptionJwk: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
  salt: Buffer;
};

export const _getEcEncryptionKey = ({
  encryption,
  kryptos,
}: EncryptOptions): EncryptResult => {
  if (!Kryptos.isEc(kryptos)) {
    throw new AesError("Invalid Kryptos type", { debug: { kryptos } });
  }

  switch (kryptos.algorithm) {
    case "ECDH-ES":
      return _getDiffieHellmanEncryptionKey({ encryption, kryptos });

    case "ECDH-ES+A128KW":
    case "ECDH-ES+A192KW":
    case "ECDH-ES+A256KW":
      return _getDiffieHellmanKeyWrapEncryptionKey({ encryption, kryptos });

    default:
      throw new AesError("Unsupported algorithm", { debug: { kryptos } });
  }
};

export const _getEcDecryptionKey = ({
  encryption,
  kryptos,
  publicEncryptionJwk,
  publicEncryptionKey,
  salt,
}: DecryptOptions): Buffer => {
  if (!Kryptos.isEc(kryptos)) {
    throw new AesError("Invalid Kryptos type", { debug: { kryptos } });
  }

  switch (kryptos.algorithm) {
    case "ECDH-ES":
      return _getDiffieHellmanDecryptionKey({
        encryption,
        kryptos,
        publicEncryptionJwk,
        salt,
      });

    case "ECDH-ES+A128KW":
    case "ECDH-ES+A192KW":
    case "ECDH-ES+A256KW":
      if (!publicEncryptionKey) {
        throw new AesError("Missing publicEncryptionKey");
      }
      return _getDiffieHellmanKeyWrapDecryptionKey({
        encryption,
        kryptos,
        publicEncryptionJwk,
        publicEncryptionKey,
        salt,
      });

    default:
      throw new AesError("Unsupported algorithm");
  }
};

import { IKryptos, Kryptos } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import { AesEncryption, PublicEncryptionJwk } from "../../../types";
import {
  _getDiffieHellmanDecryptionKey,
  _getDiffieHellmanEncryptionKey,
} from "../specific/diffie-hellman";

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

export const _getOkpEncryptionKey = ({
  encryption,
  kryptos,
}: EncryptOptions): EncryptResult => {
  if (!Kryptos.isOkp(kryptos)) {
    throw new AesError("Invalid Kryptos type", { debug: { kryptos } });
  }

  switch (kryptos.algorithm) {
    case "ECDH-ES":
      return _getDiffieHellmanEncryptionKey({ encryption, kryptos });

    default:
      throw new AesError("Unsupported algorithm", { debug: { kryptos } });
  }
};

export const _getOkpDecryptionKey = ({
  encryption,
  kryptos,
  publicEncryptionJwk,
  salt,
}: DecryptOptions): Buffer => {
  if (!Kryptos.isOkp(kryptos)) {
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

    default:
      throw new AesError("Unsupported algorithm");
  }
};

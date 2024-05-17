import { IKryptos } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import { AesEncryption, PublicEncryptionJwk } from "../../../types";
import { _getEcDecryptionKey } from "../key-types/get-ec-keys";
import { _getOctDecryptionKey } from "../key-types/get-oct-keys";
import { _getOkpDecryptionKey } from "../key-types/get-okp-keys";
import { _getRsaDecryptionKey } from "../key-types/get-rsa-keys";

type Options = {
  encryption: AesEncryption;
  kryptos: IKryptos;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
  salt?: Buffer;
};

export const _getDecryptionKey = ({
  encryption,
  kryptos,
  publicEncryptionJwk,
  publicEncryptionKey,
  salt,
}: Options): Buffer => {
  switch (kryptos.type) {
    case "EC":
      if (!publicEncryptionJwk) {
        throw new AesError("Invalid decryption data", { debug: { publicEncryptionJwk } });
      }
      if (!salt) {
        throw new AesError("Invalid decryption data", { debug: { salt } });
      }
      return _getEcDecryptionKey({
        encryption,
        kryptos,
        publicEncryptionJwk,
        publicEncryptionKey,
        salt,
      });

    case "oct":
      if (!salt) {
        throw new AesError("Invalid decryption data", { debug: { salt } });
      }
      return _getOctDecryptionKey({ encryption, kryptos, salt });

    case "OKP":
      if (!publicEncryptionJwk) {
        throw new AesError("Invalid decryption data", { debug: { publicEncryptionJwk } });
      }
      if (!salt) {
        throw new AesError("Invalid decryption data", { debug: { salt } });
      }
      return _getOkpDecryptionKey({
        encryption,
        publicEncryptionJwk,
        kryptos,
        salt,
      });

    case "RSA":
      if (!publicEncryptionKey) {
        throw new AesError("Invalid decryption data", { debug: { publicEncryptionKey } });
      }
      return _getRsaDecryptionKey({ publicEncryptionKey, kryptos });

    default:
      throw new AesError("Unexpected key type", { debug: { kryptos } });
  }
};

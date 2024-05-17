import { IKryptos, Kryptos } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import { AesEncryption } from "../../../types";
import {
  _getOctDirDecryptionKey,
  _getOctDirEncryptionKey,
} from "../specific/get-oct-dir-keys";
import {
  _getOctKeyWrapDecryptionKey,
  _getOctKeyWrapEncryptionKey,
} from "../specific/get-oct-key-wrap-keys";

type EncryptOptions = {
  encryption: AesEncryption;
  kryptos: IKryptos;
};

type EncryptResult = {
  contentEncryptionKey: Buffer;
  publicEncryptionKey?: Buffer;
  salt: Buffer;
};

type DecryptOptions = {
  encryption: AesEncryption;
  kryptos: IKryptos;
  publicEncryptionKey?: Buffer;
  salt: Buffer;
};

export const _getOctEncryptionKey = ({
  encryption,
  kryptos,
}: EncryptOptions): EncryptResult => {
  if (!Kryptos.isOct(kryptos)) {
    throw new AesError("Invalid Kryptos type", { debug: { kryptos } });
  }

  switch (kryptos.algorithm) {
    case "A128KW":
    case "A192KW":
    case "A256KW":
      return _getOctKeyWrapEncryptionKey({ encryption, kryptos });

    case "dir":
      return _getOctDirEncryptionKey({ encryption, kryptos });

    default:
      throw new AesError("Unsupported algorithm", { debug: { kryptos } });
  }
};

export const _getOctDecryptionKey = ({
  encryption,
  kryptos,
  publicEncryptionKey,
  salt,
}: DecryptOptions): Buffer => {
  if (!Kryptos.isOct(kryptos)) {
    throw new AesError("Invalid Kryptos type", { debug: { kryptos } });
  }

  switch (kryptos.algorithm) {
    case "A128KW":
    case "A192KW":
    case "A256KW":
      if (!publicEncryptionKey) {
        throw new AesError("Missing public encryption key");
      }
      return _getOctKeyWrapDecryptionKey({
        encryption,
        kryptos,
        publicEncryptionKey,
        salt,
      });

    case "dir":
      return _getOctDirDecryptionKey({ encryption, kryptos, salt });

    default:
      throw new AesError("Unsupported algorithm");
  }
};

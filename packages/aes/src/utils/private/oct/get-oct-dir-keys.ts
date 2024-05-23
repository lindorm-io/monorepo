import { Kryptos } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import { calculateContentEncryptionKeySize } from "../calculate/calculate-content-encryption-key-size";

export const getOctDirEncryptionKey = ({
  encryption,
  kryptos,
}: CreateCekOptions): CreateCekResult => {
  if (!Kryptos.isOct(kryptos)) {
    throw new AesError("Invalid Kryptos", { debug: { kryptos: kryptos.toJSON() } });
  }

  const der = kryptos.export("der");
  const keyLength = calculateContentEncryptionKeySize(encryption);

  if (der.privateKey.length !== keyLength) {
    throw new AesError("Invalid key length", {
      debug: { keyLength, privateKeyLength: der.privateKey.length },
    });
  }

  return { contentEncryptionKey: der.privateKey };
};

export const getOctDirDecryptionKey = ({
  encryption,
  kryptos,
}: DecryptCekOptions): DecryptCekResult => {
  if (!Kryptos.isOct(kryptos)) {
    throw new AesError("Invalid Kryptos", { debug: { kryptos: kryptos.toJSON() } });
  }

  const der = kryptos.export("der");
  const keyLength = calculateContentEncryptionKeySize(encryption);

  if (der.privateKey.length !== keyLength) {
    throw new AesError("Invalid key length", {
      debug: { keyLength, privateKeyLength: der.privateKey.length },
    });
  }

  return { contentEncryptionKey: der.privateKey };
};

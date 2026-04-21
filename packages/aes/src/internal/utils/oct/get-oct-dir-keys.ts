import { KryptosKit } from "@lindorm/kryptos";
import { AesError } from "../../../errors/index.js";
import type {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../types/content-encryption-key.js";
import { calculateContentEncryptionKeySize } from "../calculate/calculate-content-encryption-key-size.js";

export const getOctDirEncryptionKey = ({
  encryption,
  kryptos,
}: CreateCekOptions): CreateCekResult => {
  if (!KryptosKit.isOct(kryptos)) {
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
  if (!KryptosKit.isOct(kryptos)) {
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

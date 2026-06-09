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
    throw new AesError("Invalid Kryptos", {
      code: "invalid_kryptos",
      title: "Invalid Kryptos",
      details: "Direct (dir) encryption requires an oct (symmetric) Kryptos key type.",
      debug: { kryptos: kryptos.toJSON() },
    });
  }

  const der = kryptos.export("der");
  const keyLength = calculateContentEncryptionKeySize(encryption);

  if (der.privateKey.length !== keyLength) {
    throw new AesError("Invalid key length", {
      code: "invalid_key_length",
      title: "Invalid Key Length",
      details:
        "The direct symmetric key length does not match the size required by the requested AES encryption algorithm.",
      data: { keyLength, privateKeyLength: der.privateKey.length },
    });
  }

  return { contentEncryptionKey: der.privateKey };
};

export const getOctDirDecryptionKey = ({
  encryption,
  kryptos,
}: DecryptCekOptions): DecryptCekResult => {
  if (!KryptosKit.isOct(kryptos)) {
    throw new AesError("Invalid Kryptos", {
      code: "invalid_kryptos",
      title: "Invalid Kryptos",
      details: "Direct (dir) decryption requires an oct (symmetric) Kryptos key type.",
      debug: { kryptos: kryptos.toJSON() },
    });
  }

  const der = kryptos.export("der");
  const keyLength = calculateContentEncryptionKeySize(encryption);

  if (der.privateKey.length !== keyLength) {
    throw new AesError("Invalid key length", {
      code: "invalid_key_length",
      title: "Invalid Key Length",
      details:
        "The direct symmetric key length does not match the size required by the requested AES decryption algorithm.",
      data: { keyLength, privateKeyLength: der.privateKey.length },
    });
  }

  return { contentEncryptionKey: der.privateKey };
};

import { KryptosKit } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { AesError } from "../../../errors/index.js";
import type {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../types/content-encryption-key.js";
import { calculateContentEncryptionKeySize } from "../calculate/calculate-content-encryption-key-size.js";
import { calculateKeyWrapSize } from "../calculate/calculate-key-wrap-size.js";
import { calculatePbkdfAlgorithm } from "../calculate/calculate-pbkdf-hash.js";
import { pbkdf } from "../key-derivation/pbkdf.js";
import { ecbKeyUnwrap, ecbKeyWrap } from "../key-wrap/ecb-key-wrap.js";

export const getOctPbkdfKeyWrapEncryptionKey = ({
  encryption,
  kryptos,
}: CreateCekOptions): CreateCekResult => {
  if (!KryptosKit.isOct(kryptos)) {
    throw new AesError("Invalid Kryptos", { debug: { kryptos: kryptos.toJSON() } });
  }

  const der = kryptos.export("der");

  const cekSize = calculateContentEncryptionKeySize(encryption);
  const contentEncryptionKey = randomBytes(cekSize);

  const { derivedKey, pbkdfIterations, pbkdfSalt } = pbkdf({
    derivationKey: der.privateKey,
    keyLength: calculateKeyWrapSize(kryptos.algorithm),
    algorithm: calculatePbkdfAlgorithm(kryptos),
    kryptosAlgorithm: kryptos.algorithm,
  });

  const { publicEncryptionKey } = ecbKeyWrap({
    contentEncryptionKey,
    kryptos,
    keyEncryptionKey: derivedKey,
  });

  return {
    contentEncryptionKey,
    pbkdfIterations,
    pbkdfSalt,
    publicEncryptionKey,
  };
};

export const getOctPbkdfKeyWrapDecryptionKey = ({
  kryptos,
  pbkdfIterations,
  pbkdfSalt,
  publicEncryptionKey,
}: DecryptCekOptions): DecryptCekResult => {
  if (!KryptosKit.isOct(kryptos)) {
    throw new AesError("Invalid Kryptos", { debug: { kryptos: kryptos.toJSON() } });
  }
  if (!publicEncryptionKey) {
    throw new AesError("Missing publicEncryptionKey");
  }

  const der = kryptos.export("der");

  const { derivedKey } = pbkdf({
    derivationKey: der.privateKey,
    keyLength: calculateKeyWrapSize(kryptos.algorithm),
    algorithm: calculatePbkdfAlgorithm(kryptos),
    kryptosAlgorithm: kryptos.algorithm,
    pbkdfIterations,
    pbkdfSalt,
  });

  return ecbKeyUnwrap({
    keyEncryptionKey: derivedKey,
    kryptos,
    publicEncryptionKey,
  });
};

import { KryptosKit } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../types/content-encryption-key";
import { calculateContentEncryptionKeySize } from "../calculate/calculate-content-encryption-key-size";
import { calculateKeyWrapSize } from "../calculate/calculate-key-wrap-size";
import { calculatePbkdfAlgorithm } from "../calculate/calculate-pbkdf-hash";
import { pbkdf } from "../key-derivation/pbkdf";
import { ecbKeyUnwrap, ecbKeyWrap } from "../key-wrap/ecb-key-wrap";

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

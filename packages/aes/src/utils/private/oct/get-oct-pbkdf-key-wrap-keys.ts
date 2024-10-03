import { Kryptos } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import {
  calculateContentEncryptionKeySize,
  calculateKeyWrapSize,
  calculatePbkdfAlgorithm,
} from "../calculate";
import { pbkdf } from "../key-derivation";
import { ecbKeyUnwrap, ecbKeyWrap } from "../key-wrap";

export const getOctPbkdfKeyWrapEncryptionKey = ({
  encryption,
  kryptos,
}: CreateCekOptions): CreateCekResult => {
  if (!Kryptos.isOct(kryptos)) {
    throw new AesError("Invalid Kryptos", { debug: { kryptos: kryptos.toJSON() } });
  }

  const der = kryptos.export("der");

  const cekSize = calculateContentEncryptionKeySize(encryption);
  const contentEncryptionKey = randomBytes(cekSize);

  const { derivedKey, pbkdfIterations, pbkdfSalt } = pbkdf({
    derivationKey: der.privateKey,
    keyLength: calculateKeyWrapSize(kryptos.algorithm),
    algorithm: calculatePbkdfAlgorithm(kryptos),
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
  if (!Kryptos.isOct(kryptos)) {
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
    pbkdfIterations,
    pbkdfSalt,
  });

  return ecbKeyUnwrap({
    keyEncryptionKey: derivedKey,
    kryptos,
    publicEncryptionKey,
  });
};

import { Kryptos } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import { _calculateContentEncryptionKeySize } from "../calculate/calculate-content-encryption-key-size";
import { _calculateKeyWrapSize } from "../calculate/calculate-key-wrap-size";
import { _calculatePbkdfAlgorithm } from "../calculate/calculate-pbkdf-hash";
import { _pbkdf } from "../key-derivation/pbkdf";
import { _aesKeyUnwrap, _aesKeyWrap } from "../key-wrap/key-wrap";

export const _getOctPbkdfKeyWrapEncryptionKey = ({
  encryption,
  kryptos,
}: CreateCekOptions): CreateCekResult => {
  if (!Kryptos.isOct(kryptos)) {
    throw new AesError("Invalid Kryptos", { debug: { kryptos: kryptos.toJSON() } });
  }

  const der = kryptos.export("der");

  const cekSize = _calculateContentEncryptionKeySize(encryption);
  const contentEncryptionKey = randomBytes(cekSize);

  const { derivedKey, pbkdfIterations, pbkdfSalt } = _pbkdf({
    derivationKey: der.privateKey,
    keyLength: _calculateKeyWrapSize(kryptos.algorithm),
    algorithm: _calculatePbkdfAlgorithm(kryptos),
  });

  const publicEncryptionKey = _aesKeyWrap({
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

export const _getOctPbkdfKeyWrapDecryptionKey = ({
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

  const { derivedKey } = _pbkdf({
    derivationKey: der.privateKey,
    keyLength: _calculateKeyWrapSize(kryptos.algorithm),
    algorithm: _calculatePbkdfAlgorithm(kryptos),
    pbkdfIterations,
    pbkdfSalt,
  });

  const unwrappedKey = _aesKeyUnwrap({
    keyEncryptionKey: derivedKey,
    kryptos,
    wrappedKey: publicEncryptionKey,
  });

  return { contentEncryptionKey: unwrappedKey };
};

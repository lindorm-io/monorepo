import { Kryptos } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import { _aesKeyUnwrap, _aesKeyWrap } from "./key-wrap";
import { _createOctKeyDerivation, _decryptOctKeyDerivation } from "./oct-key-derivation";

export const _getOctKeyWrapEncryptionKey = (
  options: CreateCekOptions,
): CreateCekResult => {
  const { derivedKey, hkdfSalt, pbkdfIterations, pbkdfSalt } =
    _createOctKeyDerivation(options);

  const publicEncryptionKey = _aesKeyWrap({
    contentEncryptionKey: derivedKey,
    kryptos: options.kryptos,
    keyEncryptionKey: derivedKey,
  });

  return {
    contentEncryptionKey: derivedKey,
    hkdfSalt,
    pbkdfIterations,
    pbkdfSalt,
    publicEncryptionKey,
  };
};

export const _getOctKeyWrapDecryptionKey = ({
  encryption,
  hkdfSalt,
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

  const { derivedKey } = _decryptOctKeyDerivation({
    encryption,
    hkdfSalt,
    kryptos,
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

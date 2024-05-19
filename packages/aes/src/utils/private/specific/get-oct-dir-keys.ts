import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import { _createOctKeyDerivation, _decryptOctKeyDerivation } from "./oct-key-derivation";

export const _getOctDirEncryptionKey = (options: CreateCekOptions): CreateCekResult => {
  const { derivedKey, hkdfSalt, pbkdfIterations, pbkdfSalt } =
    _createOctKeyDerivation(options);

  return { contentEncryptionKey: derivedKey, hkdfSalt, pbkdfIterations, pbkdfSalt };
};

export const _getOctDirDecryptionKey = (options: DecryptCekOptions): DecryptCekResult => {
  const { derivedKey } = _decryptOctKeyDerivation(options);

  return { contentEncryptionKey: derivedKey };
};

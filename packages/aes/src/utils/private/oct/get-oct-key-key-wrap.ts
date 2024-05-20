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
import { _hkdf } from "../key-derivation/hkdf";
import { _keyUnwrap, _keyWrap } from "../key-wrap/key-wrap";

export const _getOctKeyWrapEncryptionKey = ({
  encryption,
  kryptos,
}: CreateCekOptions): CreateCekResult => {
  if (!Kryptos.isOct(kryptos)) {
    throw new AesError("Invalid Kryptos", { debug: { kryptos: kryptos.toJSON() } });
  }

  const der = kryptos.export("der");

  const cekSize = _calculateContentEncryptionKeySize(encryption);
  const contentEncryptionKey = randomBytes(cekSize);

  const { derivedKey, hkdfSalt } = _hkdf({
    derivationKey: der.privateKey,
    keyLength: _calculateKeyWrapSize(kryptos.algorithm),
  });

  const { publicEncryptionKey, publicEncryptionIv, publicEncryptionTag } = _keyWrap({
    contentEncryptionKey,
    kryptos,
    keyEncryptionKey: derivedKey,
  });

  return {
    contentEncryptionKey,
    hkdfSalt,
    publicEncryptionKey,
    publicEncryptionIv,
    publicEncryptionTag,
  };
};

export const _getOctKeyWrapDecryptionKey = ({
  hkdfSalt,
  kryptos,
  publicEncryptionIv,
  publicEncryptionKey,
  publicEncryptionTag,
}: DecryptCekOptions): DecryptCekResult => {
  if (!Kryptos.isOct(kryptos)) {
    throw new AesError("Invalid Kryptos", { debug: { kryptos: kryptos.toJSON() } });
  }
  if (!publicEncryptionKey) {
    throw new AesError("Missing publicEncryptionKey");
  }

  const der = kryptos.export("der");

  const { derivedKey } = _hkdf({
    derivationKey: der.privateKey,
    hkdfSalt,
    keyLength: _calculateKeyWrapSize(kryptos.algorithm),
  });

  return _keyUnwrap({
    keyEncryptionKey: derivedKey,
    kryptos,
    publicEncryptionIv,
    publicEncryptionKey,
    publicEncryptionTag,
  });
};

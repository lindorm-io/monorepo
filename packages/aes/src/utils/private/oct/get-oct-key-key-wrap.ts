import { Kryptos } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import { calculateContentEncryptionKeySize, calculateKeyWrapSize } from "../calculate";
import { hkdf } from "../key-derivation";
import { keyUnwrap, keyWrap } from "../key-wrap";

export const getOctKeyWrapEncryptionKey = ({
  encryption,
  kryptos,
}: CreateCekOptions): CreateCekResult => {
  if (!Kryptos.isOct(kryptos)) {
    throw new AesError("Invalid Kryptos", { debug: { kryptos: kryptos.toJSON() } });
  }

  const der = kryptos.export("der");

  const cekSize = calculateContentEncryptionKeySize(encryption);
  const contentEncryptionKey = randomBytes(cekSize);

  const { derivedKey, hkdfSalt } = hkdf({
    derivationKey: der.privateKey,
    keyLength: calculateKeyWrapSize(kryptos.algorithm),
  });

  const { publicEncryptionKey, publicEncryptionIv, publicEncryptionTag } = keyWrap({
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

export const getOctKeyWrapDecryptionKey = ({
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

  const { derivedKey } = hkdf({
    derivationKey: der.privateKey,
    hkdfSalt,
    keyLength: calculateKeyWrapSize(kryptos.algorithm),
  });

  return keyUnwrap({
    keyEncryptionKey: derivedKey,
    kryptos,
    publicEncryptionIv,
    publicEncryptionKey,
    publicEncryptionTag,
  });
};

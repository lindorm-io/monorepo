import { KryptosKit } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import { calculateContentEncryptionKeySize, calculateKeyWrapSize } from "../calculate";
import { keyUnwrap, keyWrap } from "../key-wrap";

export const getOctKeyWrapEncryptionKey = ({
  encryption,
  kryptos,
}: CreateCekOptions): CreateCekResult => {
  if (!KryptosKit.isOct(kryptos)) {
    throw new AesError("Invalid Kryptos", { debug: { kryptos: kryptos.toJSON() } });
  }

  const der = kryptos.export("der");

  const cekSize = calculateContentEncryptionKeySize(encryption);
  const contentEncryptionKey = randomBytes(cekSize);

  const keyWrapSize = calculateKeyWrapSize(kryptos.algorithm);
  const keyEncryptionKey = der.privateKey.subarray(0, keyWrapSize);

  const { publicEncryptionKey, publicEncryptionIv, publicEncryptionTag } = keyWrap({
    contentEncryptionKey,
    kryptos,
    keyEncryptionKey,
  });

  return {
    contentEncryptionKey,
    publicEncryptionKey,
    publicEncryptionIv,
    publicEncryptionTag,
  };
};

export const getOctKeyWrapDecryptionKey = ({
  kryptos,
  publicEncryptionIv,
  publicEncryptionKey,
  publicEncryptionTag,
}: DecryptCekOptions): DecryptCekResult => {
  if (!KryptosKit.isOct(kryptos)) {
    throw new AesError("Invalid Kryptos", { debug: { kryptos: kryptos.toJSON() } });
  }
  if (!publicEncryptionKey) {
    throw new AesError("Missing publicEncryptionKey");
  }

  const der = kryptos.export("der");

  const keyWrapSize = calculateKeyWrapSize(kryptos.algorithm);
  const keyEncryptionKey = der.privateKey.subarray(0, keyWrapSize);

  return keyUnwrap({
    keyEncryptionKey,
    kryptos,
    publicEncryptionIv,
    publicEncryptionKey,
    publicEncryptionTag,
  });
};

import { createSign, createVerify } from "crypto";
import { RsaError } from "../../errors";
import { CreateRsaSignatureOptions, VerifyRsaSignatureOptions } from "../../types";
import { getSignKey, getVerifyKey } from "./get-key";
import { mapRsaAlgorithm } from "./map-algorithm";

export const createRsaSignature = ({
  data,
  dsa,
  format,
  kryptos,
}: CreateRsaSignatureOptions): string =>
  createSign(mapRsaAlgorithm(kryptos))
    .update(data)
    .end()
    .sign(getSignKey(kryptos, dsa), format);

export const verifyRsaSignature = ({
  data,
  dsa,
  format,
  kryptos,
  signature,
}: VerifyRsaSignatureOptions): boolean =>
  createVerify(mapRsaAlgorithm(kryptos))
    .update(data)
    .end()
    .verify(getVerifyKey(kryptos, dsa), signature, format);

export const assertRsaSignature = (options: VerifyRsaSignatureOptions): void => {
  if (verifyRsaSignature(options)) return;
  throw new RsaError("Invalid signature");
};

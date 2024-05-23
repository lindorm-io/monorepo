import { createSign, createVerify } from "crypto";
import { RsaError } from "../../errors";
import { CreateRsaSignatureOptions, VerifyRsaSignatureOptions } from "../../types";
import { getSignKey, getVerifyKey } from "./get-options";
import { mapRsaAlgorithm } from "./map-algorithm";

export const createRsaSignature = ({
  data,
  format,
  kryptos,
}: CreateRsaSignatureOptions): string =>
  createSign(mapRsaAlgorithm(kryptos))
    .update(data)
    .end()
    .sign(getSignKey(kryptos), format);

export const verifyRsaSignature = ({
  data,
  format,
  kryptos,
  signature,
}: VerifyRsaSignatureOptions): boolean =>
  createVerify(mapRsaAlgorithm(kryptos))
    .update(data)
    .end()
    .verify(getVerifyKey(kryptos), signature, format);

export const assertRsaSignature = (options: VerifyRsaSignatureOptions): void => {
  if (verifyRsaSignature(options)) return;
  throw new RsaError("Invalid signature");
};

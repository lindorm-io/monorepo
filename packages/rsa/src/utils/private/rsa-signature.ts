import { isString } from "@lindorm/is";
import { createSign, createVerify } from "crypto";
import { RsaError } from "../../errors";
import { CreateRsaSignatureOptions, VerifyRsaSignatureOptions } from "../../types";
import { getSignKey, getVerifyKey } from "./get-key";
import { mapRsaAlgorithm } from "./map-algorithm";

export const createRsaSignature = ({
  data,
  dsaEncoding,
  kryptos,
}: CreateRsaSignatureOptions): Buffer =>
  createSign(mapRsaAlgorithm(kryptos))
    .update(data)
    .end()
    .sign(getSignKey(kryptos, dsaEncoding));

export const verifyRsaSignature = ({
  data,
  dsaEncoding,
  encoding,
  kryptos,
  signature,
}: VerifyRsaSignatureOptions): boolean =>
  createVerify(mapRsaAlgorithm(kryptos))
    .update(data)
    .end()
    .verify(
      getVerifyKey(kryptos, dsaEncoding),
      isString(signature) ? Buffer.from(signature, encoding) : signature,
    );

export const assertRsaSignature = (options: VerifyRsaSignatureOptions): void => {
  if (verifyRsaSignature(options)) return;
  throw new RsaError("Invalid signature");
};

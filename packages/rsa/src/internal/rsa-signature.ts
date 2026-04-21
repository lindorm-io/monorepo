import { isString } from "@lindorm/is";
import { createSign, createVerify } from "crypto";
import { RsaError } from "../errors/index.js";
import type {
  CreateRsaSignatureOptions,
  VerifyRsaSignatureOptions,
} from "../types/index.js";
import { getSignKey, getVerifyKey } from "./get-key.js";
import { mapRsaAlgorithm } from "./map-algorithm.js";

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

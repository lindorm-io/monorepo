import { isBuffer, isString } from "@lindorm/is";
import { createSign, createVerify } from "crypto";
import { EcError } from "../../errors";
import { CreateEcSignatureOptions, VerifyEcSignatureOptions } from "../../types/ec-kit";
import { getSignKey, getVerifyKey } from "./get-key";
import { mapEcAlgorithm } from "./map-algorithm";
import { derToRaw, rawToDer } from "./raw";

export const createEcSignature = ({
  data,
  dsaEncoding,
  kryptos,
  raw,
}: CreateEcSignatureOptions): Buffer => {
  const signature = createSign(mapEcAlgorithm(kryptos))
    .update(data)
    .end()
    .sign({ key: getSignKey(kryptos), dsaEncoding });

  if (raw) {
    return derToRaw(kryptos, signature);
  }

  return signature;
};

export const verifyEcSignature = ({
  data,
  dsaEncoding,
  encoding,
  kryptos,
  raw,
  signature,
}: VerifyEcSignatureOptions): boolean => {
  let buffer: Buffer;

  if (raw) {
    buffer = rawToDer(
      kryptos,
      isBuffer(signature) ? signature : Buffer.from(signature, encoding),
    );
  } else if (isString(signature)) {
    buffer = Buffer.from(signature, encoding);
  } else {
    buffer = signature;
  }

  return createVerify(mapEcAlgorithm(kryptos))
    .update(data)
    .end()
    .verify({ key: getVerifyKey(kryptos), dsaEncoding }, buffer);
};

export const assertEcSignature = ({
  data,
  dsaEncoding,
  encoding,
  kryptos,
  raw,
  signature,
}: VerifyEcSignatureOptions): void => {
  if (verifyEcSignature({ data, dsaEncoding, encoding, kryptos, raw, signature })) return;
  throw new EcError("Invalid signature");
};

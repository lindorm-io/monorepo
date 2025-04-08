import { createSign, createVerify } from "crypto";
import { EcError } from "../../errors";
import { CreateEcSignatureOptions, VerifyEcSignatureOptions } from "../../types/ec-kit";
import { getSignKey, getVerifyKey } from "./get-key";
import { mapEcAlgorithm } from "./map-algorithm";
import { derToRaw, rawToDer } from "./raw";

export const createEcSignature = ({
  data,
  dsa,
  format,
  kryptos,
}: CreateEcSignatureOptions): string => {
  const signature = createSign(mapEcAlgorithm(kryptos))
    .update(data)
    .end()
    .sign({ key: getSignKey(kryptos), dsaEncoding: dsa });

  if (format === "raw") {
    return derToRaw(kryptos, signature).toString("base64url");
  }

  return signature.toString(format);
};

export const verifyEcSignature = ({
  data,
  dsa,
  format,
  kryptos,
  signature,
}: VerifyEcSignatureOptions): boolean => {
  let buffer: Buffer;

  if (format === "raw") {
    buffer = rawToDer(kryptos, Buffer.from(signature, "base64url"));
  } else {
    buffer = Buffer.from(signature, format);
  }

  return createVerify(mapEcAlgorithm(kryptos))
    .update(data)
    .end()
    .verify({ key: getVerifyKey(kryptos), dsaEncoding: dsa }, buffer);
};

export const assertEcSignature = ({
  data,
  dsa,
  format,
  kryptos,
  signature,
}: VerifyEcSignatureOptions): void => {
  if (verifyEcSignature({ data, dsa, format, kryptos, signature })) return;
  throw new EcError("Invalid signature");
};

import { createSign, createVerify } from "crypto";
import { EcError } from "../../errors";
import { CreateEcSignatureOptions, VerifyEcSignatureOptions } from "../../types/ec-kit";
import { getSignKey, getVerifyKey } from "./get-key";
import { mapEcAlgorithm } from "./map-algorithm";
import { derToRaw, rawToDer } from "./raw";

export const createEcSignature = ({
  data,
  format,
  kryptos,
}: CreateEcSignatureOptions): string => {
  const der = createSign(mapEcAlgorithm(kryptos))
    .update(data)
    .end()
    .sign(getSignKey(kryptos));

  if (format === "raw") {
    return derToRaw(kryptos, der).toString("base64url");
  }

  return der.toString(format);
};

export const verifyEcSignature = ({
  data,
  format,
  kryptos,
  signature,
}: VerifyEcSignatureOptions): boolean => {
  let der: Buffer;

  if (format === "raw") {
    der = rawToDer(kryptos, Buffer.from(signature, "base64url"));
  } else {
    der = Buffer.from(signature, format);
  }

  return createVerify(mapEcAlgorithm(kryptos))
    .update(data)
    .end()
    .verify(getVerifyKey(kryptos), der);
};

export const assertEcSignature = ({
  data,
  format,
  kryptos,
  signature,
}: VerifyEcSignatureOptions): void => {
  if (verifyEcSignature({ data, format, kryptos, signature })) return;
  throw new EcError("Invalid signature");
};

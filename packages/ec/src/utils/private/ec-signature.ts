import { createSign, createVerify } from "crypto";
import { EcError } from "../../errors";
import { CreateEcSignatureOptions, VerifyEcSignatureOptions } from "../../types/ec-kit";
import { _getSignKey, _getVerifyKey } from "./get-key";
import { _mapEcAlgorithm } from "./map-algorithm";
import { _derToRaw, _rawToDer } from "./raw";

export const _createEcSignature = ({ data, format, kryptos }: CreateEcSignatureOptions): string => {
  const der = createSign(_mapEcAlgorithm(kryptos)).update(data).end().sign(_getSignKey(kryptos));

  if (format === "raw") {
    return _derToRaw(kryptos, der).toString("base64url");
  }

  return der.toString(format);
};

export const _verifyEcSignature = ({
  data,
  format,
  kryptos,
  signature,
}: VerifyEcSignatureOptions): boolean => {
  let der: Buffer;

  if (format === "raw") {
    der = _rawToDer(kryptos, Buffer.from(signature, "base64url"));
  } else {
    der = Buffer.from(signature, format);
  }

  return createVerify(_mapEcAlgorithm(kryptos))
    .update(data)
    .end()
    .verify(_getVerifyKey(kryptos), der);
};

export const _assertEcSignature = ({
  data,
  format,
  kryptos,
  signature,
}: VerifyEcSignatureOptions): void => {
  if (_verifyEcSignature({ data, format, kryptos, signature })) return;
  throw new EcError("Invalid signature");
};

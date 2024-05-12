import { Kryptos } from "@lindorm/kryptos";
import { createSign, createVerify } from "crypto";
import { EcError } from "../../errors";
import { CreateEcSignatureOptions, VerifyEcSignatureOptions } from "../../types/ec-kit";

export const _createEcSignature = ({
  algorithm = "SHA256",
  data,
  format = "base64",
  kryptos,
}: CreateEcSignatureOptions): string => {
  if (!Kryptos.isEc(kryptos)) {
    throw new EcError("Invalid kryptos type");
  }

  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new EcError("Missing private key");
  }

  return createSign(algorithm).update(data).end().sign(privateKey, format);
};

export const _verifyEcSignature = ({
  algorithm = "SHA256",
  data,
  format = "base64",
  kryptos,
  signature,
}: VerifyEcSignatureOptions): boolean => {
  if (!Kryptos.isEc(kryptos)) {
    throw new EcError("Invalid kryptos type");
  }

  const { publicKey } = kryptos.export("pem");

  if (!publicKey) {
    throw new EcError("Missing private key");
  }

  return createVerify(algorithm).update(data).end().verify(publicKey, signature, format);
};

export const _assertEcSignature = ({
  algorithm,
  data,
  format,
  kryptos,
  signature,
}: VerifyEcSignatureOptions): void => {
  if (_verifyEcSignature({ algorithm, data, format, kryptos, signature })) return;
  throw new EcError("Invalid signature");
};

import { Kryptos } from "@lindorm/kryptos";
import { createHmac } from "crypto";
import { OctError } from "../../errors";
import { CreateOctSignatureOptions, VerifyOctSignatureOptions } from "../../types";

export const _createOctSignature = ({
  algorithm = "SHA256",
  data,
  format = "base64",
  kryptos,
}: CreateOctSignatureOptions): string => {
  if (!Kryptos.isOct(kryptos)) {
    throw new OctError("Invalid kryptos type");
  }

  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new OctError("Missing private key");
  }

  return createHmac(algorithm, privateKey).update(data).digest(format);
};

export const _verifyOctSignature = ({
  algorithm = "SHA256",
  data,
  format = "base64",
  kryptos,
  signature,
}: VerifyOctSignatureOptions): boolean =>
  _createOctSignature({ algorithm, data, format, kryptos }) === signature;

export const _assertOctSignature = (options: VerifyOctSignatureOptions): void => {
  if (_verifyOctSignature(options)) return;
  throw new OctError("OctSignature does not match");
};

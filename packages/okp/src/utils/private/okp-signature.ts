import { Kryptos } from "@lindorm/kryptos";
import { sign, verify } from "crypto";
import { OkpError } from "../../errors";
import { CreateOkpSignatureOptions, VerifyOkpSignatureOptions } from "../../types/okp-kit";

export const _createOkpSignature = ({
  data,
  format = "base64",
  kryptos,
}: CreateOkpSignatureOptions): string => {
  if (!Kryptos.isOkp(kryptos)) {
    throw new OkpError("Invalid kryptos type");
  }

  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new OkpError("Missing private key");
  }

  return sign(undefined, Buffer.from(data, "utf8"), privateKey).toString(format);
};

export const _verifyOkpSignature = ({
  data,
  format = "base64",
  kryptos,
  signature,
}: VerifyOkpSignatureOptions): boolean => {
  if (!Kryptos.isOkp(kryptos)) {
    throw new OkpError("Invalid kryptos type");
  }

  const { publicKey } = kryptos.export("pem");

  if (!publicKey) {
    throw new OkpError("Missing private key");
  }

  return verify(undefined, Buffer.from(data, "utf8"), publicKey, Buffer.from(signature, format));
};

export const _assertOkpSignature = ({
  data,
  format,
  kryptos,
  signature,
}: VerifyOkpSignatureOptions): void => {
  if (_verifyOkpSignature({ data, format, kryptos, signature })) return;
  throw new OkpError("Invalid signature");
};

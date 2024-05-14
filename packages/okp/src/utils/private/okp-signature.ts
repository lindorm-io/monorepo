import { sign, verify } from "crypto";
import { OkpError } from "../../errors";
import { CreateOkpSignatureOptions, VerifyOkpSignatureOptions } from "../../types/okp-kit";
import { _getSignKey, _getVerifyKey } from "./get-key";

export const _createOkpSignature = ({ data, format, kryptos }: CreateOkpSignatureOptions): string =>
  sign(undefined, Buffer.from(data, "utf8"), _getSignKey(kryptos)).toString(format);

export const _verifyOkpSignature = ({
  data,
  format,
  kryptos,
  signature,
}: VerifyOkpSignatureOptions): boolean =>
  verify(
    undefined,
    Buffer.from(data, "utf8"),
    _getVerifyKey(kryptos),
    Buffer.from(signature, format),
  );

export const _assertOkpSignature = ({
  data,
  format,
  kryptos,
  signature,
}: VerifyOkpSignatureOptions): void => {
  if (_verifyOkpSignature({ data, format, kryptos, signature })) return;
  throw new OkpError("Invalid signature");
};

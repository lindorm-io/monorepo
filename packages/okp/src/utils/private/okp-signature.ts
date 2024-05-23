import { sign, verify } from "crypto";
import { OkpError } from "../../errors";
import {
  CreateOkpSignatureOptions,
  VerifyOkpSignatureOptions,
} from "../../types/okp-kit";
import { getSignKey, getVerifyKey } from "./get-key";

export const createOkpSignature = ({
  data,
  format,
  kryptos,
}: CreateOkpSignatureOptions): string =>
  sign(undefined, Buffer.from(data, "utf8"), getSignKey(kryptos)).toString(format);

export const verifyOkpSignature = ({
  data,
  format,
  kryptos,
  signature,
}: VerifyOkpSignatureOptions): boolean =>
  verify(
    undefined,
    Buffer.from(data, "utf8"),
    getVerifyKey(kryptos),
    Buffer.from(signature, format),
  );

export const assertOkpSignature = ({
  data,
  format,
  kryptos,
  signature,
}: VerifyOkpSignatureOptions): void => {
  if (verifyOkpSignature({ data, format, kryptos, signature })) return;
  throw new OkpError("Invalid signature");
};

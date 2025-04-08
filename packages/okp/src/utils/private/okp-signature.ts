import { sign, verify } from "crypto";
import { OkpError } from "../../errors";
import {
  CreateOkpSignatureOptions,
  VerifyOkpSignatureOptions,
} from "../../types/okp-kit";
import { getSignKey, getVerifyKey } from "./get-key";

export const createOkpSignature = ({
  data,
  dsa,
  format,
  kryptos,
}: CreateOkpSignatureOptions): string =>
  sign(undefined, Buffer.from(data, "utf8"), {
    key: getSignKey(kryptos),
    dsaEncoding: dsa,
  }).toString(format);

export const verifyOkpSignature = ({
  data,
  dsa,
  format,
  kryptos,
  signature,
}: VerifyOkpSignatureOptions): boolean =>
  verify(
    undefined,
    Buffer.from(data, "utf8"),
    { key: getVerifyKey(kryptos), dsaEncoding: dsa },
    Buffer.from(signature, format),
  );

export const assertOkpSignature = ({
  data,
  dsa,
  format,
  kryptos,
  signature,
}: VerifyOkpSignatureOptions): void => {
  if (verifyOkpSignature({ data, dsa, format, kryptos, signature })) return;
  throw new OkpError("Invalid signature");
};

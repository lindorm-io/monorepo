import { isString } from "@lindorm/is";
import { sign, verify } from "crypto";
import { OkpError } from "../../errors";
import {
  CreateOkpSignatureOptions,
  VerifyOkpSignatureOptions,
} from "../../types/okp-kit";
import { getSignKey, getVerifyKey } from "./get-key";

export const createOkpSignature = ({
  data,
  dsaEncoding,
  kryptos,
}: CreateOkpSignatureOptions): Buffer =>
  sign(undefined, isString(data) ? Buffer.from(data, "utf8") : data, {
    key: getSignKey(kryptos),
    dsaEncoding,
  });

export const verifyOkpSignature = ({
  data,
  dsaEncoding,
  encoding,
  kryptos,
  signature,
}: VerifyOkpSignatureOptions): boolean =>
  verify(
    undefined,
    isString(data) ? Buffer.from(data, "utf8") : data,
    { key: getVerifyKey(kryptos), dsaEncoding },
    isString(signature) ? Buffer.from(signature, encoding) : signature,
  );

export const assertOkpSignature = ({
  data,
  dsaEncoding,
  encoding,
  kryptos,
  signature,
}: VerifyOkpSignatureOptions): void => {
  if (verifyOkpSignature({ data, dsaEncoding, encoding, kryptos, signature })) return;
  throw new OkpError("Invalid signature");
};

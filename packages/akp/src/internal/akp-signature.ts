import { isString } from "@lindorm/is";
import { sign, verify } from "crypto";
import { AkpError } from "../errors";
import { CreateAkpSignatureOptions, VerifyAkpSignatureOptions } from "../types/akp-kit";
import { getSignKey, getVerifyKey } from "./get-key";

export const createAkpSignature = ({
  data,
  kryptos,
}: CreateAkpSignatureOptions): Buffer =>
  sign(null, isString(data) ? Buffer.from(data, "utf8") : data, getSignKey(kryptos));

export const verifyAkpSignature = ({
  data,
  encoding,
  kryptos,
  signature,
}: VerifyAkpSignatureOptions): boolean =>
  verify(
    null,
    isString(data) ? Buffer.from(data, "utf8") : data,
    getVerifyKey(kryptos),
    isString(signature) ? Buffer.from(signature, encoding) : signature,
  );

export const assertAkpSignature = ({
  data,
  encoding,
  kryptos,
  signature,
}: VerifyAkpSignatureOptions): void => {
  if (verifyAkpSignature({ data, encoding, kryptos, signature })) return;
  throw new AkpError("Invalid signature");
};

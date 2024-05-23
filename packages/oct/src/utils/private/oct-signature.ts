import { createHmac } from "crypto";
import { OctError } from "../../errors";
import { CreateOctSignatureOptions, VerifyOctSignatureOptions } from "../../types";
import { assertKeySize } from "./assert-key-size";
import { getPrivateKey } from "./get-key";
import { mapOctAlgorithm } from "./map-algorithm";

export const createOctSignature = ({
  data,
  format,
  kryptos,
}: CreateOctSignatureOptions): string => {
  const algorithm = mapOctAlgorithm(kryptos);
  const privateKey = getPrivateKey(kryptos);

  assertKeySize(algorithm, privateKey);

  return createHmac(algorithm, privateKey).update(data).digest(format);
};

export const verifyOctSignature = ({
  data,
  format,
  kryptos,
  signature,
}: VerifyOctSignatureOptions): boolean =>
  createOctSignature({ data, format, kryptos }) === signature;

export const assertOctSignature = (options: VerifyOctSignatureOptions): void => {
  if (verifyOctSignature(options)) return;
  throw new OctError("OctSignature does not match");
};

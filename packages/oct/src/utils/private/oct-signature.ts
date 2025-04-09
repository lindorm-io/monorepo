import { isString } from "@lindorm/is";
import { createHmac } from "crypto";
import { OctError } from "../../errors";
import { CreateOctSignatureOptions, VerifyOctSignatureOptions } from "../../types";
import { assertKeySize } from "./assert-key-size";
import { getPrivateKey } from "./get-key";
import { mapOctAlgorithm } from "./map-algorithm";

export const createOctSignature = ({
  data,
  kryptos,
}: CreateOctSignatureOptions): Buffer => {
  const algorithm = mapOctAlgorithm(kryptos);
  const privateKey = getPrivateKey(kryptos);

  assertKeySize(algorithm, privateKey);

  return createHmac(algorithm, privateKey).update(data).digest();
};

export const verifyOctSignature = ({
  data,
  encoding,
  kryptos,
  signature,
}: VerifyOctSignatureOptions): boolean =>
  createOctSignature({ data, kryptos }).equals(
    isString(signature) ? Buffer.from(signature, encoding) : signature,
  );

export const assertOctSignature = (options: VerifyOctSignatureOptions): void => {
  if (verifyOctSignature(options)) return;
  throw new OctError("OctSignature does not match");
};

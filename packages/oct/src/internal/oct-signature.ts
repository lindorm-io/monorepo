import { isString } from "@lindorm/is";
import { createHmac, timingSafeEqual } from "crypto";
import { OctError } from "../errors/index.js";
import type {
  CreateOctSignatureOptions,
  VerifyOctSignatureOptions,
} from "../types/index.js";
import { assertKeySize } from "./assert-key-size.js";
import { getPrivateKey } from "./get-key.js";
import { mapOctAlgorithm } from "./map-algorithm.js";

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
}: VerifyOctSignatureOptions): boolean => {
  const expected = createOctSignature({ data, kryptos });
  const actual = isString(signature) ? Buffer.from(signature, encoding) : signature;

  if (expected.length !== actual.length) return false;

  return timingSafeEqual(expected, actual);
};

export const assertOctSignature = (options: VerifyOctSignatureOptions): void => {
  if (verifyOctSignature(options)) return;
  throw new OctError("OctSignature does not match");
};

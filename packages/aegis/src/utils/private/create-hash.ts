import { B64 } from "@lindorm/b64";
import { KryptosAlgorithm } from "@lindorm/kryptos";
import { createHash as cryptoHash } from "crypto";
import { B64U } from "../../constants/private";

type ShaAlgorithm = "SHA256" | "SHA384" | "SHA512";

export const shaAlgorithm = (algorithm: KryptosAlgorithm): ShaAlgorithm => {
  if (algorithm.endsWith("256")) return "SHA256";
  if (algorithm.endsWith("384")) return "SHA384";
  if (algorithm.endsWith("512")) return "SHA512";

  return "SHA256";
};

const createHashBuffer = (algorithm: ShaAlgorithm, data: string): Buffer =>
  cryptoHash(algorithm).update(data, "utf8").digest();

const getLeftBits = (buffer: Buffer, bits: number): Buffer =>
  buffer.subarray(0, bits / 8);

const createHash = (algorithm: KryptosAlgorithm, data: string, bits: number): string => {
  const sha = shaAlgorithm(algorithm);
  const buffer = createHashBuffer(sha, data);
  const left = getLeftBits(buffer, bits);

  return B64.encode(left, B64U);
};

export const createAccessTokenHash = (
  algorithm: KryptosAlgorithm,
  data: string,
): string => createHash(algorithm, data, 128);

export const createCodeHash = (algorithm: KryptosAlgorithm, data: string): string =>
  createHash(algorithm, data, 256);

export const createStateHash = (algorithm: KryptosAlgorithm, data: string): string =>
  createHash(algorithm, data, 128);

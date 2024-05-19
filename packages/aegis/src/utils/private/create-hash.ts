import { B64 } from "@lindorm/b64";
import { KryptosAlgorithm } from "@lindorm/kryptos";
import { createHash } from "crypto";

type ShaAlgorithm = "SHA256" | "SHA384" | "SHA512";

export const _shaAlgorithm = (algorithm: KryptosAlgorithm): ShaAlgorithm => {
  if (algorithm.endsWith("256")) return "SHA256";
  if (algorithm.endsWith("384")) return "SHA384";
  if (algorithm.endsWith("512")) return "SHA512";

  return "SHA256";
};

const _createHashBuffer = (algorithm: ShaAlgorithm, data: string): Buffer =>
  createHash(algorithm).update(data, "utf8").digest();

const _getLeftBits = (buffer: Buffer, bits: number): Buffer =>
  buffer.subarray(0, bits / 8);

const _createHash = (algorithm: KryptosAlgorithm, data: string, bits: number): string => {
  const sha = _shaAlgorithm(algorithm);
  const buffer = _createHashBuffer(sha, data);
  const left = _getLeftBits(buffer, bits);

  return B64.encode(left, "base64url");
};

export const _createAccessTokenHash = (
  algorithm: KryptosAlgorithm,
  data: string,
): string => _createHash(algorithm, data, 128);

export const _createCodeHash = (algorithm: KryptosAlgorithm, data: string): string =>
  _createHash(algorithm, data, 256);

export const _createStateHash = (algorithm: KryptosAlgorithm, data: string): string =>
  _createHash(algorithm, data, 128);

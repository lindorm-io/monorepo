import { createHmac } from "crypto";
import { OctError } from "../../errors";
import { CreateOctSignatureOptions, VerifyOctSignatureOptions } from "../../types";
import { _assertKeySize } from "./assert-key-size";
import { _getPrivateKey } from "./get-key";
import { _mapOctAlgorithm } from "./map-algorithm";

export const _createOctSignature = ({
  data,
  format,
  kryptos,
}: CreateOctSignatureOptions): string => {
  const algorithm = _mapOctAlgorithm(kryptos);
  const privateKey = _getPrivateKey(kryptos);

  _assertKeySize(algorithm, privateKey);

  return createHmac(algorithm, privateKey).update(data).digest(format);
};

export const _verifyOctSignature = ({
  data,
  format,
  kryptos,
  signature,
}: VerifyOctSignatureOptions): boolean =>
  _createOctSignature({ data, format, kryptos }) === signature;

export const _assertOctSignature = (options: VerifyOctSignatureOptions): void => {
  if (_verifyOctSignature(options)) return;
  throw new OctError("OctSignature does not match");
};

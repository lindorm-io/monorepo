import { createSign, createVerify } from "crypto";
import { RsaError } from "../../errors";
import { CreateRsaSignatureOptions, VerifyRsaSignatureOptions } from "../../types";
import { _getSignKey, _getVerifyKey } from "./get-options";
import { _mapRsaAlgorithm } from "./map-algorithm";

export const _createRsaSignature = ({ data, format, kryptos }: CreateRsaSignatureOptions): string =>
  createSign(_mapRsaAlgorithm(kryptos)).update(data).end().sign(_getSignKey(kryptos), format);

export const _verifyRsaSignature = ({
  data,
  format,
  kryptos,
  signature,
}: VerifyRsaSignatureOptions): boolean =>
  createVerify(_mapRsaAlgorithm(kryptos))
    .update(data)
    .end()
    .verify(_getVerifyKey(kryptos), signature, format);

export const _assertRsaSignature = (options: VerifyRsaSignatureOptions): void => {
  if (_verifyRsaSignature(options)) return;
  throw new RsaError("Invalid signature");
};

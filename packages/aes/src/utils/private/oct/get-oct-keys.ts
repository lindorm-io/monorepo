import { AesAlgorithm } from "../../../enums";
import { AesEncryptionKey } from "../../../types";
import { assertSecretLength } from "../secret";
import { getOctPem } from "./get-oct-pem";

type Options = {
  algorithm: AesAlgorithm;
  key: AesEncryptionKey;
};

type Result = {
  encryptionKey: Buffer;
};

export const getOctEncryptionKeys = ({ algorithm, key }: Options): Result => {
  const pem = getOctPem(key);

  assertSecretLength({ algorithm, secret: pem.symmetricKey });

  return { encryptionKey: Buffer.from(pem.symmetricKey) };
};

export const getOctDecryptionKey = ({ algorithm, key }: Options): Buffer => {
  const pem = getOctPem(key);

  assertSecretLength({ algorithm, secret: pem.symmetricKey });

  return Buffer.from(pem.symmetricKey);
};

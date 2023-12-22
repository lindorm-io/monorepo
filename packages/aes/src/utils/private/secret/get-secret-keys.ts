import { AesAlgorithm } from "../../../enums";
import { AesSecret } from "../../../types";
import { assertSecretLength } from "./assert-secret-length";

type Options = {
  algorithm: AesAlgorithm;
  secret: AesSecret;
};

type Result = {
  encryptionKey: Buffer;
};

export const getSecretEncryptionKeys = ({ algorithm, secret }: Options): Result => {
  assertSecretLength({ algorithm, secret });

  return {
    encryptionKey: Buffer.from(secret),
  };
};

export const getSecretDecryptionKey = ({ algorithm, secret }: Options): Buffer => {
  assertSecretLength({ algorithm, secret });

  return Buffer.from(secret);
};

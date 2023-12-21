import { AesAlgorithm } from "../../../enums";
import { AesError } from "../../../errors";
import { AesSecret } from "../../../types";
import { calculateSecretLength } from "./calculate-secret-length";

type Options = {
  algorithm: AesAlgorithm;
  secret: AesSecret;
};

export const assertSecretLength = ({ algorithm, secret }: Options): void => {
  const secretLength = calculateSecretLength(algorithm);

  if (secret.length === secretLength) return;

  throw new AesError("Invalid secret", {
    description: `Secret must be ${secretLength} characters long`,
    debug: { secret, expect: secretLength, actual: secret.length },
  });
};

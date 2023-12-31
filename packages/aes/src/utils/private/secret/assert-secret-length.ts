import { AesError } from "../../../errors";
import { Encryption, Secret } from "../../../types";
import { calculateSecretLength } from "./calculate-secret-length";

type Options = {
  encryption: Encryption;
  secret: Secret;
};

export const assertSecretLength = ({ encryption, secret }: Options): void => {
  const secretLength = calculateSecretLength(encryption);

  if (secret.length === secretLength) return;

  throw new AesError("Invalid secret", {
    description: `Secret must be ${secretLength} characters long`,
    debug: { secret, expect: secretLength, actual: secret.length },
  });
};

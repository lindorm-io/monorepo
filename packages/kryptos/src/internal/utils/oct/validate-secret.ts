import { KryptosError } from "../../../errors/index.js";
import type { KryptosAlgorithm, KryptosEncryption } from "../../../types/index.js";
import { OCT_SIG_ALGORITHMS } from "../../../types/index.js";
import { getOctSize } from "./get-size.js";

type Options = {
  algorithm: KryptosAlgorithm;
  encryption?: KryptosEncryption | null;
};

const HMAC_MIN_SIZES: Record<(typeof OCT_SIG_ALGORITHMS)[number], number> = {
  HS256: 16,
  HS384: 24,
  HS512: 32,
};

const isHmac = (
  algorithm: KryptosAlgorithm,
): algorithm is (typeof OCT_SIG_ALGORITHMS)[number] =>
  (OCT_SIG_ALGORITHMS as ReadonlyArray<string>).includes(algorithm);

export const isOctSecretConformant = (options: Options, secret: Buffer): boolean => {
  if (isHmac(options.algorithm)) {
    return secret.length >= HMAC_MIN_SIZES[options.algorithm];
  }

  return secret.length === getOctSize(options);
};

export const validateOctSecret = (options: Options, secret: Buffer): void => {
  if (isOctSecretConformant(options, secret)) return;

  if (isHmac(options.algorithm)) {
    const expected = HMAC_MIN_SIZES[options.algorithm];

    throw new KryptosError("Invalid oct secret size", {
      code: "invalid_oct_secret_size",
      title: "Invalid Oct Secret Size",
      details: `The oct secret for the HMAC algorithm '${options.algorithm}' must be at least ${expected} bytes, but ${secret.length} bytes were provided.`,
      data: { algorithm: options.algorithm, expected, actual: secret.length },
    });
  }

  const expected = getOctSize(options);

  throw new KryptosError("Invalid oct secret size", {
    code: "invalid_oct_secret_size",
    title: "Invalid Oct Secret Size",
    details: `The oct secret for the algorithm '${options.algorithm}' must be exactly ${expected} bytes, but ${secret.length} bytes were provided.`,
    data: { algorithm: options.algorithm, expected, actual: secret.length },
  });
};

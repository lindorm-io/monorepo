import type { KryptosAlgClass, KryptosSigAlgorithm } from "@lindorm/kryptos";
import { AegisError } from "../../../errors/index.js";
import type { InvalidEntry } from "../../../types/index.js";

const SYMMETRIC = new Set<string>(["HS256", "HS384", "HS512"]);

const isSymmetric = (algorithm: string): boolean => SYMMETRIC.has(algorithm);

/**
 * Validates a resolved signing algorithm against a profile's crypto class.
 *
 * This AUDITS the answer; the profile's `algClass` also CONSTRAINS the question
 * — it is part of the signing floor, so a key of the wrong class is never
 * selected in the first place. The rule survives because an injected key (a
 * client secret) reaches the signer without passing the vault query, and
 * because the error it raises names the profile it violates.
 *
 * `alg: none` is never permitted (it cannot reach this rule as a
 * KryptosSigAlgorithm, but the explicit guard documents the floor).
 */
export const algPermitted = (
  algorithm: KryptosSigAlgorithm | "none" | undefined,
  algClass: KryptosAlgClass,
): Array<InvalidEntry> => {
  if (algorithm === undefined || algorithm === ("none" as string)) {
    return [{ key: "alg", message: "alg: none is never permitted" }];
  }

  switch (algClass) {
    case "asymmetric":
      return isSymmetric(algorithm)
        ? [
            {
              key: "alg",
              message: `symmetric alg "${algorithm}" is not permitted for this artifact (asymmetric only)`,
            },
          ]
        : [];

    case "symmetric":
      return isSymmetric(algorithm)
        ? []
        : [
            {
              key: "alg",
              message: `asymmetric alg "${algorithm}" is not permitted for this artifact (symmetric only)`,
            },
          ];

    default:
      throw new AegisError(`Unsupported alg class: ${algClass as string}`, {
        code: "unsupported_alg_class",
        data: { algClass },
        title: "Unsupported Alg Class",
        details:
          "A profile declared an algClass that is neither asymmetric nor symmetric, so its signing algorithm cannot be validated.",
      });
  }
};

import type { KryptosAlgClass } from "@lindorm/kryptos";
import { AegisDomainError } from "../../../errors/index.js";
import type { InvalidEntry } from "../../../types/index.js";

const SYMMETRIC = new Set<string>(["HS256", "HS384", "HS512"]);

const isSymmetric = (algorithm: string): boolean => SYMMETRIC.has(algorithm);

/**
 * Validates a signing algorithm against a profile's crypto class. Both
 * directions use it: MINT audits the algorithm of the key it resolved, VERIFY
 * the algorithm the signature was checked under.
 *
 * On the mint side this AUDITS the answer; the profile's `algClass` also
 * CONSTRAINS the question — it is part of the signing floor, so a key of the
 * wrong class is never selected in the first place. The rule survives there
 * because an injected key (a client secret) reaches the signer without passing
 * the vault query. On the verify side there is no such constraint to lean on:
 * the key is named by the token's `kid`, so this rule IS the enforcement.
 *
 * `algorithm` is a plain `string` because the verify side reads it off a
 * verified header, whose type (`TokenHeaderAlgorithm`, and `string | undefined`
 * for COSE) spans the enc algorithms too. Narrowing it to `KryptosSigAlgorithm`
 * would buy nothing but a cast at each call site — and the `"none"` arm below
 * already needed one.
 *
 * `alg: none` is never permitted for any class.
 */
export const algPermitted = (
  algorithm: string | undefined,
  algClass: KryptosAlgClass,
): Array<InvalidEntry> => {
  if (algorithm === undefined || algorithm === "none") {
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
      throw new AegisDomainError(`Unsupported alg class: ${algClass as string}`, {
        code: "unsupported_alg_class",
        data: { algClass },
        title: "Unsupported Alg Class",
        details:
          "A profile declared an algClass that is neither asymmetric nor symmetric, so its signing algorithm cannot be validated.",
      });
  }
};

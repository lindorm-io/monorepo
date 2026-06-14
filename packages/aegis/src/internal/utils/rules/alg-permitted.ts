import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { InvalidEntry } from "../../../types/index.js";

/**
 * The crypto class a profile permits for its signing algorithm (token-claims
 * §5):
 *   - `asymmetric` — access tokens, SETs (logout/erasure/secevent), DPoP:
 *     asymmetric only; `HS*`/`none` rejected.
 *   - `confidential` — server→confidential-client artifacts (id_token,
 *     userinfo, jarm, introspection): asymmetric OR `HS*` (the secret is the
 *     MAC key); `none` rejected.
 *   - `fapi` — the FAPI allowlist (`PS256`/`ES256`/`EdDSA`) only.
 */
export type AlgClass = "asymmetric" | "confidential" | "fapi";

const SYMMETRIC = new Set<string>(["HS256", "HS384", "HS512"]);

const FAPI_ALLOWLIST = new Set<string>(["PS256", "ES256", "EdDSA"]);

const isSymmetric = (algorithm: string): boolean => SYMMETRIC.has(algorithm);

/**
 * Validates a resolved signing algorithm against a profile's crypto class.
 * `alg: none` is never permitted (it cannot reach this rule as a
 * KryptosSigAlgorithm, but the explicit guard documents the floor).
 */
export const algPermitted = (
  algorithm: KryptosSigAlgorithm | "none" | undefined,
  algClass: AlgClass,
): Array<InvalidEntry> => {
  if (algorithm === undefined || algorithm === ("none" as string)) {
    return [{ key: "alg", message: "alg: none is never permitted" }];
  }

  if (algClass === "fapi") {
    if (!FAPI_ALLOWLIST.has(algorithm)) {
      return [
        {
          key: "alg",
          message: `alg "${algorithm}" is not in the FAPI allowlist (PS256, ES256, EdDSA)`,
        },
      ];
    }
    return [];
  }

  if (algClass === "asymmetric" && isSymmetric(algorithm)) {
    return [
      {
        key: "alg",
        message: `symmetric alg "${algorithm}" is not permitted for this artifact (asymmetric only)`,
      },
    ];
  }

  return [];
};

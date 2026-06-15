import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { InvalidEntry } from "../../../types/index.js";

/**
 * The crypto class a profile permits for its signing algorithm (token-claims
 * §5):
 *   - `asymmetric` — SETs (logout/erasure/secevent), DPoP: asymmetric only;
 *     `HS*`/`none` rejected.
 *   - `asymmetric-recommended` — access tokens (RFC 9068 §2.1): any signing
 *     algorithm is PERMITTED, but asymmetric is RECOMMENDED, so `HS*` is allowed
 *     and surfaced as a warning (see `algAdvisory`); only `none` is rejected.
 *   - `confidential` — server→confidential-client artifacts (id_token,
 *     userinfo, jarm, introspection): asymmetric OR `HS*` (the secret is the
 *     MAC key); `none` rejected.
 *   - `fapi` — the FAPI allowlist (`PS256`/`ES256`/`EdDSA`) only.
 */
export type AlgClass = "asymmetric" | "asymmetric-recommended" | "confidential" | "fapi";

const SYMMETRIC = new Set<string>(["HS256", "HS384", "HS512"]);

const FAPI_ALLOWLIST = new Set<string>(["PS256", "ES256", "EdDSA"]);

const isSymmetric = (algorithm: string): boolean => SYMMETRIC.has(algorithm);

/**
 * A non-fatal advisory for a resolved signing algorithm: when a profile
 * RECOMMENDS asymmetric (RFC 9068 §2.1) but a symmetric `HS*` key is used, the
 * token is still minted — the caller logs this message as a warning. Returns
 * `undefined` when there is nothing to advise.
 */
export const algAdvisory = (
  algorithm: KryptosSigAlgorithm | "none" | undefined,
  algClass: AlgClass,
): string | undefined => {
  if (algClass === "asymmetric-recommended" && algorithm && isSymmetric(algorithm)) {
    return `symmetric alg "${algorithm}" is permitted but asymmetric is RECOMMENDED for this artifact (RFC 9068 §2.1): a shared MAC secret lets any holder of it forge tokens`;
  }
  return undefined;
};

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

import type { Dict } from "@lindorm/types";
import { specByCoseName, specByJose } from "../claims/registry.js";

/**
 * The JOSE-string <-> COSE-string-name bridge — a pure, NAME-ONLY rename driven
 * by the registry's `coseName` field. It sits in the Aegis COSE format path
 * between the value translator (`domainToJose`/`joseToDomain`) and `CwtKit`, and
 * touches NO values: only the claim key changes, and only where JOSE and COSE
 * assign different names.
 *
 * RFC 8392's registered claim set diverges from JOSE at exactly one name today —
 * `jti` (JOSE) is `cti` (COSE) — so these functions rename only that pair and
 * pass every other key through verbatim. The divergence set is the registry, not
 * a hand-list, so a future divergence is picked up automatically.
 */

/**
 * Rename a JOSE-keyed claim dict to COSE names (`jti` -> `cti`). Unregistered
 * keys and claims whose COSE name equals their JOSE name pass through unchanged.
 */
export const joseToCoseNames = (jose: Dict): Dict => {
  const out: Dict = {};

  for (const [key, value] of Object.entries(jose)) {
    const spec = specByJose(key);
    out[spec?.coseName ?? key] = value;
  }

  return out;
};

/**
 * Rename a COSE-name-keyed claim dict back to JOSE names (`cti` -> `jti`).
 * Unregistered keys pass through unchanged.
 */
export const coseToJoseNames = (cose: Dict): Dict => {
  const out: Dict = {};

  for (const [key, value] of Object.entries(cose)) {
    const spec = specByCoseName(key);
    out[spec?.jose ?? key] = value;
  }

  return out;
};

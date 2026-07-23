import type { Dict } from "@lindorm/types";
import type { DomainTokenHeaderOptions, WireProtectedHeader } from "../../types/index.js";
import { headerByJose } from "../header/header-registry.js";

/**
 * Translate a caller's WIRE-named protected header bag ({@link WireProtectedHeader}
 * — `oid`/`cty`/`jku`/`x5u`/`jwk`/…) into the DOMAIN-named header options the JOSE
 * encoder consumes, so the shared wire header bag rides the SAME `mapTokenHeader`
 * pipeline (canonical sort, registry-driven) as the kit-derived fields. Each wire
 * key is looked up in the header registry (`headerByJose`) and re-keyed to its
 * domain name; an unregistered key is dropped (headers are a CLOSED set). The
 * KitOwned params (`alg`/`kid`/`typ`/`iv`/…) never reach here — they are removed
 * from {@link WireProtectedHeader} at the type level.
 */
export const wireHeaderToDomainOptions = (
  header: WireProtectedHeader | undefined,
): DomainTokenHeaderOptions => {
  if (!header) return {};

  const result: Dict = {};
  for (const key of Object.keys(header)) {
    const spec = headerByJose(key);
    if (!spec) continue;
    result[spec.domain] = (header as Dict)[key];
  }

  return result as DomainTokenHeaderOptions;
};

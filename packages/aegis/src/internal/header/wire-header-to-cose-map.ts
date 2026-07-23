import type { WireTokenHeader } from "../../types/index.js";
import { coseByJose } from "./header-registry.js";

/**
 * The WRITE-side translation — the inverse direction of `mergeCoseWireHeader`:
 * turn a caller's wire-named partial COSE header bag into a COSE integer-label
 * map, each wire name resolved to its COSE label via the header registry
 * (`coseByJose`, which THROWS for a param COSE has no integer label for).
 * Undefined values are skipped. Value shaping is passthrough — the caller-settable
 * COSE params (`typ`/`cty`/`crit`/`x5c`/`x5u`) already carry their wire
 * representation, which round-trips back through `mergeCoseWireHeader` on read.
 */
export const wireHeaderToCoseMap = (
  bag: Partial<WireTokenHeader> | undefined,
): Map<number, unknown> => {
  const map = new Map<number, unknown>();

  if (!bag) return map;

  for (const [jose, value] of Object.entries(bag)) {
    if (value === undefined) continue;
    map.set(coseByJose(jose), value);
  }

  return map;
};

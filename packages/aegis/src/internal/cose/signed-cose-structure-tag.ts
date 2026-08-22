import type { IKryptos } from "@lindorm/kryptos";
import { CwsError } from "../../errors/index.js";
import { type CoseStructureTag, coseStructureTag } from "./cose-structure-tag.js";

/**
 * Which COSE integrity structure a resolved key implies. RFC 9052 §4.4,
 * RFC 9052 §6.3. The ONE gate every signed COSE verb asks.
 *
 * ⚠ ONE function, so sign and verify cannot come to disagree about which
 * structure a key produces; where a verb needs the tag twice it is computed once
 * and passed. The kits gate `algClass` in their constructors, so this is settled
 * by the time any verb runs.
 */
export const signedCoseStructureTag = (kryptos: IKryptos): CoseStructureTag =>
  coseStructureTag({
    algClass: kryptos.algClass,
    error: CwsError,
    details:
      "The resolved key's algClass is neither asymmetric nor symmetric, so no COSE integrity structure applies.",
  });

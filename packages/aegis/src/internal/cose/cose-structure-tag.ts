import type { KryptosAlgClass } from "@lindorm/kryptos";
import type { CoseError } from "../../errors/index.js";
import { COSE_TAG } from "./structures.js";

/** The COSE integrity structure a signed token can carry. */
export type CoseStructureTag = typeof COSE_TAG.sign1 | typeof COSE_TAG.mac0;

/**
 * The COSE integrity split, decided by the KEY's `algClass` and nothing else: an
 * asymmetric key gives a COSE_Sign1 over `Sig_structure` (RFC 9052 §4.4), a
 * symmetric `oct` key a COSE_Mac0 over `MAC_structure` (RFC 9052 §6.3).
 *
 * ⚠ The `cose_unhandled_alg_class` throw is unreachable — `KryptosAlgClass` is a
 * closed two-member union, so it is the compiler backstop. `error` and `details`
 * stay caller-supplied because each site answers under its own leaf class.
 */
export const coseStructureTag = ({
  algClass,
  error,
  details,
}: {
  algClass: KryptosAlgClass;
  error: typeof CoseError;
  details: string;
}): CoseStructureTag => {
  switch (algClass) {
    case "asymmetric":
      return COSE_TAG.sign1;

    case "symmetric":
      return COSE_TAG.mac0;

    default: {
      const exhaustive: never = algClass;
      throw new error("Unhandled COSE key class", {
        code: "cose_unhandled_alg_class",
        data: { algClass: String(exhaustive) },
        title: "Unhandled COSE Key Class",
        details,
      });
    }
  }
};

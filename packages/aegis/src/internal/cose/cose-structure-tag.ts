import type { KryptosAlgClass } from "@lindorm/kryptos";
import type { CoseError } from "../../errors/index.js";
import { COSE_TAG } from "./structures.js";

/** The COSE integrity structure a signed token can carry (RFC 9052 §4.4 / §6.3). */
export type CoseStructureTag = typeof COSE_TAG.sign1 | typeof COSE_TAG.mac0;

/**
 * The COSE integrity split (RFC 9052), decided by the KEY's `algClass` and
 * nothing else: an asymmetric key produces a COSE_Sign1 (tag 18) over
 * `Sig_structure`, a symmetric `oct` key a COSE_Mac0 (tag 17) over
 * `MAC_structure` — HMAC is a MAC algorithm, never a Sign1 signature.
 *
 * Three sites asked this same question with three copies of the same switch (the
 * opaque signer's `sign` and `verify`, and the claims-kit dispatch), each
 * carrying a byte-identical `cose_unhandled_alg_class` throw. The throw is
 * unreachable — `KryptosAlgClass` is a closed two-member union, so it is the
 * compiler backstop — but `error` and `details` stay caller-supplied because each
 * site answers under its own leaf class and in its own words.
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

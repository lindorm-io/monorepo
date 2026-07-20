import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { CwmKit } from "../../classes/CwmKit.js";
import { CwtKit } from "../../classes/CwtKit.js";
import { AegisError } from "../../errors/index.js";

/**
 * The COSE integrity split (Bit 9), dispatched off the RESOLVED key's `algClass`
 * — the dispatch the dropped `CoseKit` façade used to own, now called directly
 * by the COSE verb utils. An asymmetric key mints/verifies via `CwtKit`
 * (COSE_Sign1), a symmetric `oct` key via `CwmKit` (COSE_Mac0). Each kit
 * re-asserts its own class, so a mis-dispatch throws rather than mis-securing.
 */
export const selectCoseClaimsKit = ({
  kryptos,
  logger,
  clockTolerance,
}: {
  kryptos: IKryptos;
  logger: ILogger;
  clockTolerance?: number;
}): CwtKit | CwmKit => {
  switch (kryptos.algClass) {
    case "asymmetric":
      return new CwtKit({ kryptos, logger, clockTolerance });
    case "symmetric":
      return new CwmKit({ kryptos, logger, clockTolerance });
    default: {
      const exhaustive: never = kryptos.algClass;
      throw new AegisError("Unhandled COSE key class", {
        code: "cose_unhandled_alg_class",
        data: { algClass: String(exhaustive) },
        title: "Unhandled COSE Key Class",
        details:
          "The resolved key's algClass is neither asymmetric nor symmetric, so no COSE claims kit applies.",
      });
    }
  }
};

import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { CwmKit } from "../../classes/CwmKit.js";
import { CwtKit } from "../../classes/CwtKit.js";
import { CoseError } from "../../errors/index.js";
import type { CertificateBindingMode } from "../../types/index.js";
import { coseStructureTag } from "./cose-structure-tag.js";
import { COSE_TAG } from "./structures.js";

/**
 * The COSE integrity split, dispatched off the RESOLVED key's `algClass`: an
 * asymmetric key goes to `CwtKit` (COSE_Sign1), a symmetric `oct` key to `CwmKit`
 * (COSE_Mac0). ⚠ Each kit re-asserts its own class, so a mis-dispatch throws
 * rather than mis-securing.
 *
 * Only the KIT is decided here — the class→structure question is the same one the
 * opaque signer asks, and is asked in the same place.
 */
export const selectCoseClaimsKit = ({
  certBindingMode,
  kryptos,
  logger,
  clockTolerance,
}: {
  certBindingMode?: CertificateBindingMode;
  kryptos: IKryptos;
  logger: ILogger;
  clockTolerance?: number;
}): CwtKit | CwmKit =>
  coseStructureTag({
    algClass: kryptos.algClass,
    error: CoseError,
    details:
      "The resolved key's algClass is neither asymmetric nor symmetric, so no COSE claims kit applies.",
  }) === COSE_TAG.sign1
    ? new CwtKit({ certBindingMode, kryptos, logger, clockTolerance })
    : new CwmKit({ certBindingMode, kryptos, logger, clockTolerance });

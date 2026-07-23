import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import { CwmKit } from "../../classes/CwmKit.js";
import { CwtKit } from "../../classes/CwtKit.js";
import { domainToCose } from "../claims/translate.js";
import type { OmitMode } from "../utils/apply-omit.js";

/**
 * Mint a secured CWT from the DOMAIN-keyed common claims — the domain⇆wire
 * boundary (R18). Translate domain → COSE wire (`domainToCose`), then dispatch to
 * the claims kit by the explicit `format` (D6): `cwt` → `CwtKit` (COSE_Sign1,
 * asymmetric), `cwm` → `CwmKit` (COSE_Mac0, symmetric). The WRITE side selects the
 * kit by FORMAT, not the resolved key's `algClass` — the kit's own class gate is
 * the backstop, so `format: "cwt"` with a symmetric key THROWS instead of silently
 * MAC-ing. `proprietary` threads to BOTH the claim codec and the kit's interop
 * alg gate. (The READ path keeps `algClass` dispatch — see `verify-cose.ts`.)
 */
export const signCose = ({
  kryptos,
  logger,
  common,
  tokenType,
  proprietary,
  omit,
  format,
}: {
  kryptos: IKryptos;
  logger: ILogger;
  common: Dict;
  /** The bare TYPE PREFIX; the kit builds `application/<prefix>+cwt` (or bare cwt). */
  tokenType?: string;
  proprietary?: boolean;
  omit?: OmitMode;
  format: "cwt" | "cwm";
}): Buffer => {
  const kit =
    format === "cwm" ? new CwmKit({ kryptos, logger }) : new CwtKit({ kryptos, logger });

  return kit.sign(domainToCose(common), { tokenType, proprietary, omit });
};

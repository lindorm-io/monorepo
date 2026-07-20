import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import { domainToCose } from "../claims/translate.js";
import type { OmitMode } from "../utils/apply-omit.js";
import { selectCoseClaimsKit } from "./cose-claims-kit.js";

/**
 * Mint a secured CWT (COSE_Sign1 or COSE_Mac0) from the DOMAIN-keyed common
 * claims — the domain⇆wire boundary (R18) the dropped `CoseKit` façade owned.
 * Translate domain → COSE wire (`domainToCose`), then dispatch to the claims kit
 * by `algClass`. `proprietary` threads to BOTH the claim codec and the kit's
 * interop alg gate.
 */
export const signCose = ({
  kryptos,
  logger,
  common,
  typ,
  proprietary,
  omit,
}: {
  kryptos: IKryptos;
  logger: ILogger;
  common: Dict;
  typ?: string;
  proprietary?: boolean;
  omit?: OmitMode;
}): Buffer =>
  selectCoseClaimsKit({ kryptos, logger }).sign(domainToCose(common), {
    typ,
    proprietary,
    omit,
  });

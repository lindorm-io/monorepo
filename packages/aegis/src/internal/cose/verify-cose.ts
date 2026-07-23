import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import { coseToDomain } from "../claims/translate.js";
import { selectCoseClaimsKit } from "./cose-claims-kit.js";

export type CoseVerifyResult = {
  /** The DOMAIN-keyed claims (custom claims camelCased), the verified payload. */
  claims: Dict;
  /**
   * The COSE-name-keyed WIRE claims (the kit output before `coseToDomain`), fed
   * to the Aegis identity/presence validation — `exp`/`nbf`/`iss`/`aud`/… share
   * the JOSE names, so the JOSE matchers apply to it unchanged. Temporal claims
   * are `Date`s here (the codec's "date" kind).
   */
  wire: Dict;
  typ: string | undefined;
};

/**
 * Verify a CWT with an already-resolved key and translate the WIRE claims back
 * to the domain shape (the read twin of `signCose`). Returns BOTH the domain
 * claims and the COSE-name-keyed wire the Aegis identity/presence floor consumes.
 * The claims kit is picked by `algClass` and runs the in-kit temporal range
 * check (R10) with the supplied clock tolerance.
 */
export const verifyCose = ({
  kryptos,
  logger,
  token,
  clockTolerance,
  currentDate,
  maxTokenAge,
}: {
  kryptos: IKryptos;
  logger: ILogger;
  token: Buffer;
  clockTolerance?: number;
  /** Override "now" for the in-kit temporal range check (R10). Per-call only. */
  currentDate?: Date;
  /** Reject a token whose `iat` is older than this many seconds (R10). Per-call only. */
  maxTokenAge?: number;
}): CoseVerifyResult => {
  const { payload: wire, header } = selectCoseClaimsKit({
    kryptos,
    logger,
    clockTolerance,
  }).verify(token, undefined, { clockTolerance, currentDate, maxTokenAge });

  const { claims, custom } = coseToDomain(wire);

  return { claims: { ...claims, ...custom }, wire, typ: header.typ };
};

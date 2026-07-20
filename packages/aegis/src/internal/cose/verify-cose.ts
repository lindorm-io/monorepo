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
  protectedHeader: Map<number, unknown>;
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
}: {
  kryptos: IKryptos;
  logger: ILogger;
  token: Buffer;
  clockTolerance?: number;
}): CoseVerifyResult => {
  const {
    claims: wire,
    protectedHeader,
    typ,
  } = selectCoseClaimsKit({ kryptos, logger, clockTolerance }).verify(token);

  const { claims, custom } = coseToDomain(wire);

  return { claims: { ...claims, ...custom }, wire, protectedHeader, typ };
};

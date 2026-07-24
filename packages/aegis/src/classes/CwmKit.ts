import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict, Predicate } from "@lindorm/types";
import { CwmError } from "../errors/index.js";
import type { ICwmKit } from "../interfaces/index.js";
import { decodeCwtWire, signCwt, verifyCwt } from "../internal/cose/cwt-token.js";
import type {
  CwtClaimsWire,
  DecodedStructuredToken,
  SignStructuredTokenOptions,
  VerifiedStructuredToken,
  VerifyStructuredTokenOptions,
} from "../types/index.js";

export type CwmKitSettings = {
  kryptos: IKryptos;
  logger: ILogger;
  /** Clock skew tolerance (seconds) for the in-kit temporal range check. */
  clockTolerance?: number;
};

/**
 * CWT (RFC 8392) as a COSE_Mac0 — the symmetric twin of `CwtKit`. Same wire-only
 * thin shape (transform-free `sign`, structural `verify` with kid fail-fast and
 * temporal-in-kit R10), but the integrity structure is a MAC, not a signature.
 *
 * INTEGRITY GATE (Bit 9): `CwmKit` is COSE_Mac0 and requires a SYMMETRIC `oct`
 * key — it throws on an asymmetric one (that is `CwtKit`'s COSE_Sign1). Aegis
 * dispatches the two off the RESOLVED key's `algClass`.
 */
export class CwmKit implements ICwmKit {
  private readonly kryptos: IKryptos;
  private readonly logger: ILogger;
  private readonly clockTolerance: number;

  constructor(options: CwmKitSettings) {
    if (options.kryptos.algClass !== "symmetric") {
      throw new CwmError("CwmKit requires a symmetric key", {
        code: "cwm_requires_symmetric_key",
        data: { algClass: options.kryptos.algClass },
        title: "CwmKit Requires Symmetric Key",
        details:
          "CwmKit issues COSE_Mac0 CWTs, which require a symmetric oct key; an asymmetric key must use CwtKit (COSE_Sign1).",
      });
    }

    this.kryptos = options.kryptos;
    this.logger = options.logger.child(["CwmKit"]);
    this.clockTolerance = options.clockTolerance ?? 0;
  }

  sign<C extends Dict = Dict>(
    claims: CwtClaimsWire & C,
    options: SignStructuredTokenOptions = {},
  ): Buffer {
    return signCwt(this.kryptos, this.logger, "cwm", claims, options);
  }

  verify<C extends Dict = Dict>(
    token: Buffer,
    assert?: Predicate<CwtClaimsWire & C>,
    options: VerifyStructuredTokenOptions = {},
  ): VerifiedStructuredToken<CwtClaimsWire & C, Buffer> {
    return verifyCwt<C>(this.kryptos, this.logger, {
      format: "cwm",
      token,
      assert,
      clockTolerance: options.clockTolerance ?? this.clockTolerance,
      options,
    });
  }

  /**
   * WIRE decode (no MAC check): the unified wire header (protected + unprotected
   * COSE maps merged, integer labels translated to their JOSE wire names) + the
   * cleartext WIRE claim payload + the raw COSE MAC tag bytes. The uniform
   * primitive shared with `JwtKit`/`CwtKit` decode.
   */
  static decode<C extends Dict = Dict>(
    token: Buffer,
  ): DecodedStructuredToken<CwtClaimsWire & C> {
    return decodeCwtWire<C>(token);
  }
}

import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Predicate } from "@lindorm/types";
import { AegisError } from "../errors/index.js";
import {
  type CwtDecoded,
  type CwtSignOptions,
  type CwtVerifyOptions,
  type CwtVerifyResult,
  decodeCwt,
  signCwt,
  verifyCwt,
} from "../internal/cose/cwt-token.js";
import type { CwtWireClaims } from "../types/index.js";

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
export class CwmKit {
  private readonly kryptos: IKryptos;
  private readonly logger: ILogger;
  private readonly clockTolerance: number;

  constructor(options: CwmKitSettings) {
    if (options.kryptos.algClass !== "symmetric") {
      throw new AegisError("CwmKit requires a symmetric key", {
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

  sign<C extends CwtWireClaims = CwtWireClaims>(
    claims: C,
    options: CwtSignOptions = {},
  ): Buffer {
    return signCwt(this.kryptos, this.logger, claims, options);
  }

  verify<C extends CwtWireClaims = CwtWireClaims>(
    token: Buffer,
    assert?: Predicate<C>,
    options: CwtVerifyOptions = {},
  ): CwtVerifyResult<C> {
    return verifyCwt<C>(this.kryptos, this.logger, {
      format: "cwm",
      token,
      assert,
      clockTolerance: options.clockTolerance ?? this.clockTolerance,
      options,
    });
  }

  static decode(token: Buffer): CwtDecoded {
    return decodeCwt(token);
  }
}

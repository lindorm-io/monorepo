import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Predicate } from "@lindorm/types";
import { CwtError } from "../errors/index.js";
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

export type {
  CwtDecoded,
  CwtSignOptions,
  CwtVerifyOptions,
  CwtVerifyResult,
} from "../internal/cose/cwt-token.js";

export type CwtKitSettings = {
  kryptos: IKryptos;
  logger: ILogger;
  /** Clock skew tolerance (seconds) for the in-kit temporal range check. */
  clockTolerance?: number;
};

/**
 * CWT (RFC 8392) as a COSE_Sign1 — the asymmetric, signature-bearing claims kit,
 * the COSE analogue of `JwtKit`. It speaks ONLY the wire: `sign` serializes an
 * already-COSE-keyed `CwtWireClaims` dict verbatim (R18) and secures it with a
 * COSE_Sign1; `verify` runs the structural + prudent SECURITY invariants (kid,
 * typ well-formedness, algorithm-match, signature, temporal range R10) plus a
 * caller `assert`, returning the native WIRE payload (`cti`/`exp`, not
 * `tokenId`/`expiresAt`). All DOMAIN policy lives on the Aegis verify path.
 *
 * INTEGRITY GATE (Bit 9): `CwtKit` is COSE_Sign1 and requires an ASYMMETRIC key —
 * it throws on a symmetric one. A symmetric `oct` key MUST use `CwmKit`
 * (COSE_Mac0); HMAC is a MAC, never a Sign1 signature. Aegis dispatches the two
 * off the RESOLVED key's `algClass`.
 */
export class CwtKit {
  private readonly kryptos: IKryptos;
  private readonly logger: ILogger;
  private readonly clockTolerance: number;

  constructor(options: CwtKitSettings) {
    if (options.kryptos.algClass !== "asymmetric") {
      throw new CwtError("CwtKit requires an asymmetric key", {
        code: "cwt_requires_asymmetric_key",
        data: { algClass: options.kryptos.algClass },
        title: "CwtKit Requires Asymmetric Key",
        details:
          "CwtKit issues COSE_Sign1 CWTs, which require an asymmetric signing key; a symmetric key must use CwmKit (COSE_Mac0).",
      });
    }

    this.kryptos = options.kryptos;
    this.logger = options.logger.child(["CwtKit"]);
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
      format: "cwt",
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

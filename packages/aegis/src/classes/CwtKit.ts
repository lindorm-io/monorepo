import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict, Predicate } from "@lindorm/types";
import { CwtError } from "../errors/index.js";
import type { ICwtKit } from "../interfaces/index.js";
import {
  type CwtDecoded,
  decodeCwt,
  decodeCwtWire,
  signCwt,
  verifyCwt,
} from "../internal/cose/cwt-token.js";
import type {
  CwtClaimsWire,
  DecodedStructuredToken,
  SignStructuredTokenOptions,
  VerifiedStructuredToken,
  VerifyStructuredTokenOptions,
} from "../types/index.js";

export type { CwtDecoded } from "../internal/cose/cwt-token.js";

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
export class CwtKit implements ICwtKit {
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

  sign<C extends Dict = Dict>(
    claims: CwtClaimsWire & C,
    options: SignStructuredTokenOptions = {},
  ): Buffer {
    return signCwt(this.kryptos, this.logger, "cwt", claims, options);
  }

  verify<C extends Dict = Dict>(
    token: Buffer,
    assert?: Predicate<CwtClaimsWire & C>,
    options: VerifyStructuredTokenOptions = {},
  ): VerifiedStructuredToken<CwtClaimsWire & C, Buffer> {
    return verifyCwt<C>(this.kryptos, this.logger, {
      format: "cwt",
      token,
      assert,
      clockTolerance: options.clockTolerance ?? this.clockTolerance,
      options,
    });
  }

  /**
   * WIRE decode (no signature check): the unified wire header (protected +
   * unprotected COSE maps merged, integer labels translated to their JOSE wire
   * names) + the cleartext WIRE claim payload. The uniform primitive shared with
   * `JwtKit`/`CwmKit` decode.
   */
  decode<C extends Dict = Dict>(
    token: Buffer,
  ): DecodedStructuredToken<CwtClaimsWire & C> {
    return decodeCwtWire<C>(token);
  }

  static decode(token: Buffer): CwtDecoded {
    return decodeCwt(token);
  }
}

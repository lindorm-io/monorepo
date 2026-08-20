import type { Condition } from "@lindorm/match";
import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import { CwtError } from "../errors/index.js";
import type { ICwtKit } from "../interfaces/index.js";
import { decodeCwtWire } from "../internal/cose/decode-cwt-wire.js";
import { signCwt } from "../internal/cose/sign-cwt.js";
import { verifyCwt } from "../internal/cose/verify-cwt.js";
import type {
  CertificateBindingMode,
  CwtKitSettings,
  CwtClaimsWire,
  CoseDecodedStructuredToken,
  CoseSignStructuredTokenOptions,
  CoseVerifiedStructuredToken,
  VerifyStructuredTokenOptions,
} from "../types/index.js";

/**
 * CWT (RFC 8392) as a COSE_Sign1 — the asymmetric, signature-bearing claims kit,
 * the COSE analogue of `JwtKit`. It speaks ONLY the wire: `sign` serializes an
 * already-COSE-keyed `CwtWireClaims` dict verbatim and secures it with a
 * COSE_Sign1; `verify` runs the structural + prudent SECURITY invariants (kid,
 * typ well-formedness, algorithm-match, signature, temporal range) plus a
 * caller `assert`, returning the native WIRE payload (`cti`/`exp`, not
 * `tokenId`/`expiresAt`). All DOMAIN policy lives on the Aegis verify path.
 *
 * INTEGRITY GATE: `CwtKit` is COSE_Sign1 and requires an ASYMMETRIC key —
 * it throws on a symmetric one. A symmetric `oct` key MUST use `CwmKit`
 * (COSE_Mac0); HMAC is a MAC, never a Sign1 signature. Aegis dispatches the two
 * off the RESOLVED key's `algClass`.
 */
export class CwtKit implements ICwtKit {
  private readonly kryptos: IKryptos;
  private readonly logger: ILogger;
  private readonly clockTolerance: number;
  private readonly certBindingMode: CertificateBindingMode;

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
    this.certBindingMode = options.certBindingMode ?? "strict";
  }

  sign<C extends Dict = Dict>(
    claims: CwtClaimsWire & C,
    options: CoseSignStructuredTokenOptions = {},
  ): Buffer {
    return signCwt(this.kryptos, this.logger, "cwt", claims, options);
  }

  verify<C extends Dict = Dict>(
    token: Buffer,
    assert?: Condition<CwtClaimsWire & C>,
    options: VerifyStructuredTokenOptions = {},
  ): CoseVerifiedStructuredToken<CwtClaimsWire & C> {
    return verifyCwt<C>(this.kryptos, this.logger, {
      format: "cwt",
      token,
      assert,
      clockTolerance: options.clockTolerance ?? this.clockTolerance,
      certBindingMode: options.certBindingMode ?? this.certBindingMode,
      options,
    });
  }

  /**
   * WIRE decode (no signature check): the unified wire header (protected +
   * unprotected COSE maps merged, integer labels translated to their JOSE wire
   * names) + the cleartext WIRE claim payload + the raw COSE signature bytes. The
   * uniform primitive shared with `JwtKit`/`CwmKit` decode.
   */
  static decode<C extends Dict = Dict>(
    token: Buffer,
  ): CoseDecodedStructuredToken<CwtClaimsWire & C> {
    return decodeCwtWire<C>(token);
  }
}

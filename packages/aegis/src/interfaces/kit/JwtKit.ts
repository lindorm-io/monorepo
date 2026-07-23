import type { Dict, Predicate } from "@lindorm/types";
import type {
  DecodedStructuredToken,
  JwtClaimsWire,
  SignStructuredTokenOptions,
  VerifiedStructuredToken,
  VerifyStructuredTokenOptions,
} from "../../types/index.js";

export interface IJwtKit {
  sign<C extends Dict = Dict>(
    claims: JwtClaimsWire & C,
    options?: SignStructuredTokenOptions,
  ): string;
  verify<C extends Dict = Dict>(
    token: string,
    assert?: Predicate<JwtClaimsWire & C>,
    options?: VerifyStructuredTokenOptions,
  ): VerifiedStructuredToken<JwtClaimsWire & C, string>;
  /**
   * WIRE-only read (no signature check): the unified wire header + the cleartext
   * JWT claim payload. Uniform with `CwtKit`/`CwmKit` decode.
   */
  decode<C extends Dict = Dict>(
    token: string,
  ): DecodedStructuredToken<JwtClaimsWire & C, string>;
}

import type { Dict, Predicate } from "@lindorm/types";
import type {
  DecodedJwtToken,
  JwtWireClaims,
  ParsedJwt,
  SignJwtWireOptions,
  VerifyJwtWireOptions,
} from "../../types/index.js";

export interface IJwtKit {
  sign<C extends Dict = Dict>(
    claims: JwtWireClaims & C,
    options?: SignJwtWireOptions,
  ): string;
  verify<C extends Dict = Dict>(
    token: string,
    assert?: Predicate<JwtWireClaims & C>,
    options?: VerifyJwtWireOptions,
  ): ParsedJwt<C>;
  /**
   * WIRE-only read (no signature check): the unified wire header + the cleartext
   * JWT claim payload. Uniform with `CwtKit`/`CwmKit` decode.
   */
  decode<C extends Dict = Dict>(token: string): DecodedJwtToken<C>;
}

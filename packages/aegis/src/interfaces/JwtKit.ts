import type { Dict, Predicate } from "@lindorm/types";
import type {
  JwtWireClaims,
  ParsedJwt,
  SignJwtWireOptions,
  VerifyJwtWireOptions,
} from "../types/index.js";

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
}

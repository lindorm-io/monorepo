import type { Dict, Predicate } from "@lindorm/types";
import type {
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
}

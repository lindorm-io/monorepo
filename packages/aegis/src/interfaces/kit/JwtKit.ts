import type { Condition } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
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
    assert?: Condition<JwtClaimsWire & C>,
    options?: VerifyStructuredTokenOptions,
  ): VerifiedStructuredToken<JwtClaimsWire & C, string>;
}

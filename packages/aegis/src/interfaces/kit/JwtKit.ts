import type { Condition } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
import type {
  JwtClaimsWire,
  JoseSignStructuredTokenOptions,
  VerifiedStructuredToken,
  VerifyStructuredTokenOptions,
} from "../../types/index.js";

export interface IJwtKit {
  sign<C extends Dict = Dict>(
    claims: JwtClaimsWire & C,
    options?: JoseSignStructuredTokenOptions,
  ): string;
  verify<C extends Dict = Dict>(
    token: string,
    assert?: Condition<JwtClaimsWire & C>,
    options?: VerifyStructuredTokenOptions,
  ): VerifiedStructuredToken<JwtClaimsWire & C, string>;
}

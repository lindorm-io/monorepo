import { Dict } from "@lindorm/types";
import { SignJwtContent, SignJwtOptions, SignedJwt } from "../jwt/jwt-sign";
import { VerifiedJwt, VerifyJwtOptions } from "../jwt/jwt-verify";

export interface IJwtKit {
  sign<T extends Dict = Dict>(
    content: SignJwtContent<T>,
    options?: SignJwtOptions,
  ): SignedJwt;
  verify<T extends Dict = Dict>(jwt: string, verify?: VerifyJwtOptions): VerifiedJwt<T>;
}

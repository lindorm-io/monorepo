import { Dict } from "@lindorm/types";
import {
  SignJwtContent,
  SignJwtOptions,
  SignedJwt,
  VerifiedJwt,
  VerifyJwtOptions,
} from "../types";

export interface IJwtKit {
  sign<T extends Dict = Dict>(
    content: SignJwtContent<T>,
    options?: SignJwtOptions,
  ): SignedJwt;
  verify<T extends Dict = Dict>(jwt: string, verify?: VerifyJwtOptions): VerifiedJwt<T>;
}

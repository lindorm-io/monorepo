import type { Dict } from "@lindorm/types";
import type {
  ParsedJwt,
  SignJwtContent,
  SignJwtOptions,
  SignedJwt,
  VerifyJwtOptions,
} from "../types/index.js";

export interface IJwtKit {
  sign<T extends Dict = Dict>(
    content: SignJwtContent<T>,
    options?: SignJwtOptions,
  ): SignedJwt;
  verify<T extends Dict = Dict>(token: string, verify?: VerifyJwtOptions): ParsedJwt<T>;
}

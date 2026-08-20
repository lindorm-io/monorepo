import type {
  JoseSignUnstructuredTokenOptions,
  TokenContent,
  JoseVerifiedUnstructuredToken,
  VerifyUnstructuredTokenOptions,
} from "../../types/index.js";

export interface IJwsKit {
  /** Sign arbitrary content; the cty is negotiated. Returns the BARE compact JWS. */
  sign(data: TokenContent, options?: JoseSignUnstructuredTokenOptions): string;
  verify<T extends TokenContent = Buffer>(
    token: string,
    options?: VerifyUnstructuredTokenOptions,
  ): JoseVerifiedUnstructuredToken<T>;
}

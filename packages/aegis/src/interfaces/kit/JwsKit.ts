import type {
  SignUnstructuredTokenOptions,
  TokenContent,
  VerifiedUnstructuredToken,
  VerifyUnstructuredTokenOptions,
} from "../../types/index.js";

export interface IJwsKit {
  /** Sign arbitrary content; the cty is negotiated. Returns the BARE compact JWS. */
  sign(data: TokenContent, options?: SignUnstructuredTokenOptions): string;
  verify<T extends TokenContent = Buffer>(
    token: string,
    options?: VerifyUnstructuredTokenOptions,
  ): VerifiedUnstructuredToken<T, string>;
}

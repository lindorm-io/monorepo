import type {
  DecodedUnstructuredToken,
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
  /**
   * WIRE-only read (no signature check): the unified wire header + the
   * cty-reconstructed payload + the native token. Uniform with `CwsKit` decode.
   */
  decode<T extends TokenContent = Buffer>(
    token: string,
  ): DecodedUnstructuredToken<T, string>;
}

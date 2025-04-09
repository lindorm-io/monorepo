import { Dict } from "@lindorm/types";
import { ParsedTokenHeader, TokenHeaderClaims } from "../header";
import {
  JwtClaims,
  JwtKitOptions,
  ParsedJwtPayload,
  SignedJwt,
  SignJwtContent,
  SignJwtOptions,
  ValidateJwtOptions,
  VerifyJwtOptions,
} from "../jwt";

export type CwtClaims = JwtClaims;

export type DecodedCwt<C extends Dict = Dict> = {
  protected: Pick<TokenHeaderClaims, "alg" | "crit" | "cty" | "typ">;
  unprotected: Omit<TokenHeaderClaims, "alg" | "crit" | "cty" | "typ">;
  payload: JwtClaims & C;
  signature: Buffer;
};

export type CwtKitOptions = JwtKitOptions;

export type ParsedCwtHeader = Omit<ParsedTokenHeader, "headerType"> & {
  headerType: "application/cwt";
};

export type ParsedCwtPayload<C extends Dict = Dict> = ParsedJwtPayload<C>;

export type ParsedCwt<C extends Dict = Dict> = {
  decoded: DecodedCwt<C>;
  header: ParsedCwtHeader;
  payload: ParsedJwtPayload<C>;
  token: string;
};

export type SignCwtContent<C extends Dict = Dict> = SignJwtContent<C>;

export type SignCwtOptions = SignJwtOptions;

export type SignedCwt = SignedJwt;

export type ValidateCwtOptions = ValidateJwtOptions;

export type VerifyCwtOptions = VerifyJwtOptions;

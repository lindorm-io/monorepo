import type { Dict } from "@lindorm/types";
import type { OmitMode } from "../../internal/utils/apply-omit.js";
import type {
  BindCertificateMode,
  CertBindingMode,
  TokenEncryptOrSignOptions,
} from "../header.js";
import type { DecodedJwt } from "./jwt-decode.js";
import type { ParsedJwtHeader } from "./jwt-parse.js";
import type { JwtWireClaims } from "./jwt-wire-claims.js";

/**
 * Options for the TRANSFORM-FREE wire `JwtKit.sign` (R18). The kit serializes the
 * already-wire jose-keyed claim dict verbatim (modulo `omit`): no auto
 * `iat`/`jti`/`nbf`/`iss`, no hash derivation, no case/name mapping. Everything
 * domain — the envelope, the claim translation — is assembled Aegis-side before
 * the dict reaches the kit.
 */
export type SignJwtWireOptions = {
  bindCertificate?: BindCertificateMode;
  header?: TokenEncryptOrSignOptions;
  objectId?: string;
  omit?: OmitMode;
  /**
   * The JOSE `typ` header PREFIX. The kit constructs the full media type from it
   * (it knows its format): `"at"` → `application/at+jwt`. An absent/empty/`null`
   * prefix floors to the bare `"JWT"`. The domain tokenType→prefix mapping is
   * Aegis-side.
   */
  typ?: string | null;
};

/**
 * Options for the wire `JwtKit.verify`. Every field is a WIRE structural knob —
 * no named domain matchers, no presence policy (those live Aegis-side).
 */
export type VerifyJwtWireOptions = {
  certBindingMode?: CertBindingMode;
  clockTolerance?: number;
  /**
   * Assert the header `typ` equals the media type the kit builds from this
   * PREFIX (`"at"` → `application/at+jwt`). Aegis derives the prefix from the
   * domain `tokenType`.
   */
  typ?: string;
};

/**
 * The native WIRE result of `JwtKit.verify` / structural parse: the raw decoded
 * segments, the DOMAIN-named header (mirrors `ParsedJws`), the WIRE claim
 * payload (jose keys — `sub`/`exp`, not `subject`/`expiresAt`), and the token.
 * The domain claim translation + delegation/dpop enrichment happen Aegis-side.
 */
export type ParsedJwtWire<C extends Dict = Dict> = {
  decoded: DecodedJwt<C>;
  header: ParsedJwtHeader;
  payload: JwtWireClaims & C;
  token: string;
};

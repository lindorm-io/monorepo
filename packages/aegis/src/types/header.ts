import type { PublicEncryptionJwk } from "@lindorm/aes";
import type { KryptosEncryption, KryptosJwk } from "@lindorm/kryptos";
import type {
  TOKEN_HEADER_ALGORITHMS,
  TOKEN_HEADER_TYPES,
} from "../internal/constants/header.js";

export type TokenHeaderAlgorithm = (typeof TOKEN_HEADER_ALGORITHMS)[number];

export type TokenHeaderType = (typeof TOKEN_HEADER_TYPES)[number] | (string & {});

// https://www.rfc-editor.org/rfc/rfc7515.html#section-4.1
export type TokenHeaderClaims = {
  alg: TokenHeaderAlgorithm; // algorithm
  crit?: Array<string>;
  cty?: string; // content type
  enc?: KryptosEncryption; // encryption
  epk?: PublicEncryptionJwk; // public encryption jwk
  iv?: string; // public encryption iv
  jku?: string; // jwks uri
  jwk?: KryptosJwk; // jwk
  kid?: string; // key id
  oid?: string; // object id
  p2c?: number; // p2c
  p2s?: string; // p2s
  tag?: string; // public encryption tag
  typ?: string; // header type (optional per RFC 7515 Section 4.1.9)
  x5c?: Array<string>;
  x5t?: string;
  "x5t#S256"?: string;
};

export type RawTokenHeaderClaims = {
  alg?: TokenHeaderAlgorithm;
  crit?: Array<string>;
  cty?: string;
  enc?: KryptosEncryption;
  epk?: PublicEncryptionJwk;
  iv?: Buffer;
  jku?: string;
  jwk?: KryptosJwk;
  kid?: string;
  oid?: string;
  p2c?: number;
  p2s?: Buffer;
  tag?: Buffer;
  typ?: TokenHeaderType;
  x5c?: Array<string>;
  x5t?: string;
  "x5t#S256"?: string;
};

export type DecodedTokenHeader = TokenHeaderClaims;

export type BaseTokenFormat = "JWT" | "JWS" | "JWE";

export type ParsedTokenHeader = {
  algorithm: TokenHeaderAlgorithm;
  baseFormat: BaseTokenFormat | undefined;
  contentType: string | undefined;
  critical: Array<string>;
  encryption: KryptosEncryption | undefined;
  headerType: string | undefined;
  initialisationVector: string | undefined;
  jwk: KryptosJwk | undefined;
  jwksUri: string | undefined;
  keyId: string | undefined;
  objectId: string | undefined;
  pbkdfIterations: number | undefined;
  pbkdfSalt: string | undefined;
  publicEncryptionJwk: PublicEncryptionJwk | undefined;
  publicEncryptionTag: string | undefined;
  tokenType: string | undefined;
  x5c: Array<string> | undefined;
  x5t: string | undefined;
  x5tS256: string | undefined;
};

export type TokenHeaderOptions = {
  algorithm?: TokenHeaderAlgorithm;
  contentType?: string;
  critical?: Array<string>;
  encryption?: KryptosEncryption;
  headerType?: TokenHeaderType;
  initialisationVector?: Buffer;
  jwk?: KryptosJwk;
  jwksUri?: string;
  keyId?: string;
  objectId?: string;
  pbkdfIterations?: number;
  pbkdfSalt?: Buffer;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionTag?: Buffer;
  // --- Full RFC-registered set: the remaining user-supplyable JOSE header
  //     parameters. Carried verbatim under their registered wire names (like
  //     `x5c`/`x5t#S256` in the parsed header), for RFC 7515/7516/7518
  //     completeness. Additive — no encoder consumes them yet.
  x5u?: string; // RFC 7515 §4.1.5 — X.509 URL
  x5t?: string; // RFC 7515 §4.1.7 — X.509 certificate SHA-1 thumbprint (base64url)
  zip?: string; // RFC 7516 §4.1.3 — compression algorithm ("DEF" is the only registered value)
  apu?: string; // RFC 7518 §4.6.1.2 — ECDH-ES Agreement PartyUInfo (base64url)
  apv?: string; // RFC 7518 §4.6.1.3 — ECDH-ES Agreement PartyVInfo (base64url)
};

export type CertificateHeaderFields = {
  x5c?: Array<string>;
  x5tS256?: string;
};

export type TokenEncryptOrSignOptions = Pick<TokenHeaderOptions, "jwk">;

export type BindCertificateMode = "thumbprint" | "chain" | "none";

export type CertBindingMode = "strict" | "lax";

export type RefinedTokenHeader<A> = Omit<
  ParsedTokenHeader,
  "algorithm" | "baseFormat" | "headerType"
> & {
  algorithm: A;
  baseFormat: BaseTokenFormat;
  headerType: string;
};

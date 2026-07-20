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
  apu?: string; // ecdh-es party u info
  apv?: string; // ecdh-es party v info
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
  x5u?: string; // x.509 url
  zip?: string; // compression algorithm
};

export type RawTokenHeaderClaims = {
  alg?: TokenHeaderAlgorithm;
  apu?: string;
  apv?: string;
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
  x5u?: string;
  zip?: string;
};

export type DecodedTokenHeader = TokenHeaderClaims;

export type BaseTokenFormat = "JWT" | "JWS" | "JWE";

export type ParsedTokenHeader = {
  algorithm: TokenHeaderAlgorithm;
  baseFormat: BaseTokenFormat | undefined;
  certificateChain: Array<string> | undefined;
  certificateThumbprint: string | undefined;
  certificateThumbprintSha1: string | undefined;
  certificateUrl: string | undefined;
  contentType: string | undefined;
  critical: Array<string>;
  encryption: KryptosEncryption | undefined;
  headerType: string | undefined;
  initialisationVector: string | undefined;
  jwk: KryptosJwk | undefined;
  jwksUri: string | undefined;
  keyId: string | undefined;
  objectId: string | undefined;
  partyProducer: string | undefined; // apu — ECDH-ES Agreement PartyUInfo
  partyRecipient: string | undefined; // apv — ECDH-ES Agreement PartyVInfo
  pbkdfIterations: number | undefined;
  pbkdfSalt: string | undefined;
  publicEncryptionJwk: PublicEncryptionJwk | undefined;
  publicEncryptionTag: string | undefined;
  tokenType: string | undefined;
  zip: string | undefined;
};

export type TokenHeaderOptions = {
  algorithm?: TokenHeaderAlgorithm;
  // RFC 7515 §4.1.7 — X.509 certificate SHA-1 thumbprint (base64url); wire `x5t`.
  certificateThumbprintSha1?: string;
  // RFC 7515 §4.1.5 — X.509 URL; wire `x5u`.
  certificateUrl?: string;
  contentType?: string;
  critical?: Array<string>;
  encryption?: KryptosEncryption;
  headerType?: TokenHeaderType;
  initialisationVector?: Buffer;
  jwk?: KryptosJwk;
  jwksUri?: string;
  keyId?: string;
  objectId?: string;
  partyProducer?: string; // apu — RFC 7518 §4.6.1.2 ECDH-ES Agreement PartyUInfo (base64url)
  partyRecipient?: string; // apv — RFC 7518 §4.6.1.3 ECDH-ES Agreement PartyVInfo (base64url)
  pbkdfIterations?: number;
  pbkdfSalt?: Buffer;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionTag?: Buffer;
  zip?: string; // RFC 7516 §4.1.3 — compression algorithm ("DEF" is the only registered value)
};

export type CertificateHeaderFields = {
  certificateChain?: Array<string>;
  certificateThumbprint?: string;
};

export type TokenEncryptOrSignOptions = Pick<TokenHeaderOptions, "jwk">;

export type BindCertificateMode = "thumbprint" | "chain" | "none";

export type CertificateBindingMode = "strict" | "lax";

export type RefinedTokenHeader<A> = Omit<
  ParsedTokenHeader,
  "algorithm" | "baseFormat" | "headerType"
> & {
  algorithm: A;
  baseFormat: BaseTokenFormat;
  headerType: string;
};

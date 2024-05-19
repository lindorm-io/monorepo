import { PublicEncryptionJwk } from "@lindorm/aes";
import { KryptosAlgorithm, KryptosEncryption, KryptosJwk } from "@lindorm/kryptos";

export type TokenHeaderAlgorithm = KryptosAlgorithm;

export type TokenHeaderType = "JWE" | "JWS" | "JWT";

// https://www.rfc-editor.org/rfc/rfc7515.html#section-4.1
export type TokenHeaderClaims = {
  alg: TokenHeaderAlgorithm; // algorithm
  crit?: Array<Exclude<keyof TokenHeaderClaims, "crit">>;
  cty?: string; // content type
  enc?: KryptosEncryption; // encryption
  epk?: PublicEncryptionJwk; // public encryption jwk
  hkdf_salt?: string; // salt
  jku?: string; // jwks uri
  jwk?: KryptosJwk; // jwk
  kid?: string; // key id
  oid?: string; // object id
  p2c?: number; // p2c
  p2s?: string; // p2s
  typ: TokenHeaderType; // header type
  x5c?: Array<string>;
  x5t?: string;
  x5u?: string;
  "x5t#S256"?: string;
};

export type DecodedTokenHeader = TokenHeaderClaims;

export type ParsedTokenHeader = {
  algorithm: TokenHeaderAlgorithm;
  contentType: string | undefined;
  critical: Array<Exclude<keyof ParsedTokenHeader, "critical">>;
  encryption: KryptosEncryption | undefined;
  headerType: TokenHeaderType;
  hkdfSalt: string | undefined;
  jwk: KryptosJwk | undefined;
  jwksUri: string | undefined;
  keyId: string | undefined;
  objectId: string | undefined;
  pbkdfIterations: number | undefined;
  pbkdfSalt: string | undefined;
  publicEncryptionJwk: PublicEncryptionJwk | undefined;
  x5c: Array<string> | undefined;
  x5t: string | undefined;
  x5u: string | undefined;
  x5tS256: string | undefined;
};

export type TokenHeaderSignOptions = {
  algorithm: TokenHeaderAlgorithm;
  contentType?: string;
  critical?: Array<Exclude<keyof TokenHeaderSignOptions, "critical">>;
  encryption?: KryptosEncryption;
  headerType: TokenHeaderType;
  hkdfSalt?: string;
  jwk?: KryptosJwk;
  jwksUri?: string;
  keyId: string;
  objectId?: string;
  pbkdfIterations?: number;
  pbkdfSalt?: string;
  publicEncryptionJwk?: PublicEncryptionJwk;
  x5c?: Array<string>;
  x5t?: string;
  x5u?: string;
  x5tS256?: string;
};

import { PublicEncryptionJwk } from "@lindorm/aes";
import { KryptosEncryption, KryptosJwk } from "@lindorm/kryptos";
import { TOKEN_HEADER_ALGORITHMS, TOKEN_HEADER_TYPES } from "../constants/private";

export type TokenHeaderAlgorithm = (typeof TOKEN_HEADER_ALGORITHMS)[number];

export type TokenHeaderType = (typeof TOKEN_HEADER_TYPES)[number];

// https://www.rfc-editor.org/rfc/rfc7515.html#section-4.1
export type TokenHeaderClaims = {
  alg: TokenHeaderAlgorithm; // algorithm
  crit?: Array<Exclude<keyof TokenHeaderClaims, "crit">>;
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
  typ: TokenHeaderType; // header type
  x5c?: Array<string>;
  x5t?: string;
  x5u?: string;
  "x5t#S256"?: string;
};

export type RawTokenHeaderClaims = {
  alg?: TokenHeaderAlgorithm;
  crit?: Array<Exclude<keyof TokenHeaderOptions, "critical">>;
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
  initialisationVector: string | undefined;
  jwk: KryptosJwk | undefined;
  jwksUri: string | undefined;
  keyId: string | undefined;
  objectId: string | undefined;
  pbkdfIterations: number | undefined;
  pbkdfSalt: string | undefined;
  publicEncryptionJwk: PublicEncryptionJwk | undefined;
  publicEncryptionTag: string | undefined;
  x5c: Array<string> | undefined;
  x5t: string | undefined;
  x5u: string | undefined;
  x5tS256: string | undefined;
};

export type TokenHeaderOptions = {
  algorithm?: TokenHeaderAlgorithm;
  contentType?: string;
  critical?: Array<Exclude<keyof TokenHeaderOptions, "critical">>;
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
  x5c?: Array<string>;
  x5t?: string;
  x5tS256?: string;
  x5u?: string;
};

export type TokenEncryptOrSignOptions = Pick<
  TokenHeaderOptions,
  "jwk" | "x5c" | "x5t" | "x5tS256" | "x5u"
>;

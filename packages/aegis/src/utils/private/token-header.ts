import { B64 } from "@lindorm/b64";
import { isFinite, isObject, isString, isUrlLike } from "@lindorm/is";
import { removeUndefined } from "@lindorm/utils";
import {
  DecodedTokenHeader,
  ParsedTokenHeader,
  TokenHeaderAlgorithm,
  TokenHeaderClaims,
  TokenHeaderSignOptions,
  TokenHeaderType,
} from "../../types";

const ALGS: Array<TokenHeaderAlgorithm> = [
  "A128KW",
  "A192KW",
  "A256KW",
  "dir",
  "ECDH-ES",
  "ECDH-ES+A128KW",
  "ECDH-ES+A192KW",
  "ECDH-ES+A256KW",
  "EdDSA",
  "ES256",
  "ES384",
  "ES512",
  "HS256",
  "HS384",
  "HS512",
  "PBES2-HS256+A128KW",
  "PBES2-HS384+A192KW",
  "PBES2-HS512+A256KW",
  "RS256",
  "RS384",
  "RS512",
  "RSA-OAEP",
  "RSA-OAEP-256",
  "RSA-OAEP-384",
  "RSA-OAEP-512",
] as const;

const TYPES: Array<TokenHeaderType> = ["JWE", "JWS", "JWT"] as const;

export const _encodeTokenHeader = (header: TokenHeaderSignOptions): string => {
  if (!header.algorithm) {
    throw new Error("Algorithm is required");
  }
  if (!ALGS.includes(header.algorithm)) {
    throw new Error(`Invalid algorithm: ${header.algorithm}`);
  }
  if (!header.headerType) {
    throw new Error("Header type is required");
  }
  if (!TYPES.includes(header.headerType)) {
    throw new Error(`Invalid header type: ${header.headerType}`);
  }
  if (!header.keyId) {
    throw new Error("Key ID is required");
  }

  const crit = header.critical
    ?.map((key) => {
      switch (key) {
        case "algorithm":
          return "alg";
        case "contentType":
          return "cty";
        case "encryption":
          return "enc";
        case "headerType":
          return "typ";
        case "hkdfSalt":
          return "hkdf_salt";
        case "jwk":
          return "jwk";
        case "jwksUri":
          return "jku";
        case "keyId":
          return "kid";
        case "objectId":
          return "oid";
        case "pbkdfIterations":
          return "p2c";
        case "pbkdfSalt":
          return "p2s";
        case "publicEncryptionJwk":
          return "epk";
        case "x5c":
          return "x5c";
        case "x5t":
          return "x5t";
        case "x5u":
          return "x5u";
        case "x5tS256":
          return "x5t#S256";
        default:
          return undefined;
      }
    })
    .filter(isString) as TokenHeaderClaims["crit"];

  const claims: TokenHeaderClaims = removeUndefined({
    alg: header.algorithm,
    crit,
    cty: header.contentType,
    enc: isString(header.encryption) ? header.encryption : undefined,
    epk: isObject(header.publicEncryptionJwk) ? header.publicEncryptionJwk : undefined,
    hkdf_salt: isString(header.hkdfSalt) ? header.hkdfSalt : undefined,
    jku: isUrlLike(header.jwksUri) ? header.jwksUri : undefined,
    jwk: isObject(header.jwk) ? header.jwk : undefined,
    kid: header.keyId,
    oid: isString(header.objectId) ? header.objectId : undefined,
    p2c: isFinite(header.pbkdfIterations) ? header.pbkdfIterations : undefined,
    p2s: isString(header.pbkdfSalt) ? header.pbkdfSalt : undefined,
    typ: header.headerType,
    x5c: isString(header.x5c) ? header.x5c : undefined,
    x5t: isString(header.x5t) ? header.x5t : undefined,
    x5u: isString(header.x5u) ? header.x5u : undefined,
    "x5t#S256": isString(header.x5tS256) ? header.x5tS256 : undefined,
  });

  return B64.encode(JSON.stringify(claims), "base64url");
};

export const _decodeTokenHeader = (header: string): DecodedTokenHeader => {
  const string = B64.toString(header);
  const json = JSON.parse(string) as Partial<TokenHeaderClaims>;

  if (!json.alg) {
    throw new Error("Missing token header: alg");
  }
  if (!ALGS.includes(json.alg)) {
    throw new Error(`Invalid token header: alg: ${json.alg}`);
  }
  if (!json.typ) {
    throw new Error("Missing token header: typ");
  }
  if (!TYPES.includes(json.typ)) {
    throw new Error(`Invalid token header: typ: ${json.typ}`);
  }

  return json as DecodedTokenHeader;
};

export const _parseTokenHeader = <T extends ParsedTokenHeader = ParsedTokenHeader>(
  decoded: DecodedTokenHeader,
): T => {
  const critical =
    (decoded.crit
      ?.map((key) => {
        switch (key) {
          case "alg":
            return "algorithm";
          case "cty":
            return "contentType";
          case "enc":
            return "encryption";
          case "epk":
            return "publicEncryptionJwk";
          case "hkdf_salt":
            return "hkdfSalt";
          case "jku":
            return "jwksUri";
          case "jwk":
            return "jwk";
          case "kid":
            return "keyId";
          case "oid":
            return "objectId";
          case "p2c":
            return "pbkdfIterations";
          case "p2s":
            return "pbkdfSalt";
          case "typ":
            return "headerType";
          case "x5c":
            return "x5c";
          case "x5t":
            return "x5t";
          case "x5u":
            return "x5u";
          case "x5t#S256":
            return "x5tS256";
          default:
            return undefined;
        }
      })
      .filter(isString) as ParsedTokenHeader["critical"]) ?? [];

  return removeUndefined({
    algorithm: decoded.alg,
    contentType: decoded.cty,
    critical,
    encryption: decoded.enc,
    headerType: decoded.typ,
    hkdfSalt: decoded.hkdf_salt,
    jwk: decoded.jwk,
    jwksUri: decoded.jku,
    keyId: decoded.kid,
    objectId: decoded.oid,
    pbkdfIterations: decoded.p2c,
    pbkdfSalt: decoded.p2s,
    publicEncryptionJwk: decoded.epk,
    x5c: decoded.x5c,
    x5t: decoded.x5t,
    x5u: decoded.x5u,
    x5tS256: decoded["x5t#S256"],
  }) as T;
};

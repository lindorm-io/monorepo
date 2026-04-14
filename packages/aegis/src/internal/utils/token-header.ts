import { isFinite, isObject, isString, isUrlLike } from "@lindorm/is";
import { removeUndefined } from "@lindorm/utils";
import {
  CertificateHeaderFields,
  DecodedTokenHeader,
  ParsedTokenHeader,
  RawTokenHeaderClaims,
  TokenHeaderOptions,
} from "../../types";
import { getBaseFormat } from "./compute-typ-header";

export const mapTokenHeader = (
  options: TokenHeaderOptions,
  cert: CertificateHeaderFields = {},
): RawTokenHeaderClaims => {
  const crit = options.critical
    ?.map((key): string => {
      switch (key) {
        case "algorithm":
          return "alg";
        case "contentType":
          return "cty";
        case "encryption":
          return "enc";
        case "headerType":
          return "typ";
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
        case "initialisationVector":
          return "iv";
        case "publicEncryptionJwk":
          return "epk";
        case "publicEncryptionTag":
          return "tag";
        default:
          return key; // Pass through unknown params for rejection by the Kit class
      }
    })
    .sort();

  return removeUndefined({
    alg: options.algorithm,
    crit,
    cty: options.contentType,
    enc: isString(options.encryption) ? options.encryption : undefined,
    epk: isObject(options.publicEncryptionJwk) ? options.publicEncryptionJwk : undefined,
    iv: options.initialisationVector,
    jku: isUrlLike(options.jwksUri) ? options.jwksUri : undefined,
    jwk: isObject(options.jwk) ? options.jwk : undefined,
    kid: options.keyId,
    oid: isString(options.objectId) ? options.objectId : undefined,
    p2c: isFinite(options.pbkdfIterations) ? options.pbkdfIterations : undefined,
    p2s: options.pbkdfSalt,
    tag: options.publicEncryptionTag,
    typ: options.headerType,
    x5c: Array.isArray(cert.x5c) ? cert.x5c : undefined,
    "x5t#S256": isString(cert.x5tS256) ? cert.x5tS256 : undefined,
  });
};

export const parseTokenHeader = <T extends ParsedTokenHeader = ParsedTokenHeader>(
  decoded: DecodedTokenHeader,
): T => {
  const critical =
    (decoded.crit
      ?.map((key): string => {
        switch (key) {
          case "alg":
            return "algorithm";
          case "cty":
            return "contentType";
          case "enc":
            return "encryption";
          case "epk":
            return "publicEncryptionJwk";
          case "iv":
            return "initialisationVector";
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
          case "tag":
            return "publicEncryptionTag";
          case "typ":
            return "headerType";
          case "x5c":
            return "x5c";
          case "x5t":
            return "x5t";
          case "x5t#S256":
            return "x5tS256";
          default:
            return key; // Pass through unknown params for rejection by the Kit class
        }
      })
      .sort() as ParsedTokenHeader["critical"]) ?? [];

  return removeUndefined({
    algorithm: decoded.alg,
    baseFormat: getBaseFormat(decoded.typ),
    contentType: decoded.cty,
    critical,
    encryption: decoded.enc,
    headerType: decoded.typ,
    initialisationVector: decoded.iv,
    jwk: decoded.jwk,
    jwksUri: decoded.jku,
    keyId: decoded.kid,
    objectId: decoded.oid,
    pbkdfIterations: decoded.p2c,
    pbkdfSalt: decoded.p2s,
    publicEncryptionJwk: decoded.epk,
    publicEncryptionTag: decoded.tag,
    x5c: decoded.x5c,
    x5t: decoded.x5t,
    x5tS256: decoded["x5t#S256"],
  }) as T;
};

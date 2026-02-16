import { isFinite, isObject, isString, isUrlLike } from "@lindorm/is";
import { removeUndefined } from "@lindorm/utils";
import {
  DecodedTokenHeader,
  ParsedTokenHeader,
  RawTokenHeaderClaims,
  TokenHeaderOptions,
} from "../../types";

export const mapTokenHeader = (options: TokenHeaderOptions): RawTokenHeaderClaims => {
  const crit = options.critical
    ?.map((key): Exclude<keyof RawTokenHeaderClaims, "crit"> | undefined => {
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
    .filter(isString)
    .sort() as RawTokenHeaderClaims["crit"];

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
    x5c: isString(options.x5c) ? options.x5c : undefined,
    x5t: isString(options.x5t) ? options.x5t : undefined,
    x5u: isString(options.x5u) ? options.x5u : undefined,
    "x5t#S256": isString(options.x5tS256) ? options.x5tS256 : undefined,
  });
};

export const parseTokenHeader = <T extends ParsedTokenHeader = ParsedTokenHeader>(
  decoded: DecodedTokenHeader,
): T => {
  const critical =
    (decoded.crit
      ?.map((key): Exclude<keyof ParsedTokenHeader, "crit"> | undefined => {
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
          case "x5u":
            return "x5u";
          case "x5t#S256":
            return "x5tS256";
          default:
            return undefined;
        }
      })
      .filter(isString)
      .sort() as ParsedTokenHeader["critical"]) ?? [];

  return removeUndefined({
    algorithm: decoded.alg,
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
    x5u: decoded.x5u,
    x5tS256: decoded["x5t#S256"],
  }) as T;
};

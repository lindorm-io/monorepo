import { ChangeCase, changeKeys } from "@lindorm/case";
import { KryptosError } from "../../errors";
import {
  EcKeyJwk,
  KryptosB64,
  KryptosDer,
  KryptosFromJwk,
  KryptosJwkOptions,
  KryptosPem,
  KryptosRaw,
  KryptosStdOptions,
  KryptosType,
  OctKeyJwk,
  OkpKeyJwk,
  RsaKeyJwk,
} from "../../types";
import { _createEcDerFromJwk, _createEcDerFromPem, _createEcDerFromRaw } from "./ec";
import { _createOctDerFromJwk, _createOctDerFromPem } from "./oct";
import { _createOkpDerFromJwk, _createOkpDerFromPem } from "./okp";
import { _createRsaDerFromJwk, _createRsaDerFromPem } from "./rsa";

const TYPES: Array<KryptosType> = ["EC", "oct", "OKP", "RSA"] as const;

export const _fromJwkOptions = (from: KryptosJwkOptions): KryptosStdOptions => {
  const jwk = changeKeys(from, ChangeCase.Snake);

  return {
    id: jwk.kid,
    algorithm: jwk.alg,
    createdAt: jwk.iat ? new Date(jwk.iat * 1000) : undefined,
    expiresAt: jwk.exp ? new Date(jwk.exp * 1000) : undefined,
    isExternal: true,
    issuer: jwk.iss,
    jwksUri: jwk.jku,
    notBefore: jwk.nbf ? new Date(jwk.nbf * 1000) : undefined,
    operations: jwk.key_ops,
    ownerId: jwk.owner_id,
    updatedAt: jwk.uat ? new Date(jwk.uat * 1000) : undefined,
    use: jwk.use,
  };
};

export const _fromStdOptions = (from: KryptosStdOptions): KryptosStdOptions => ({
  id: from.id,
  algorithm: from.algorithm,
  createdAt: from.createdAt,
  expiresAt: from.expiresAt,
  isExternal: from.isExternal,
  issuer: from.issuer,
  jwksUri: from.jwksUri,
  notBefore: from.notBefore,
  operations: from.operations,
  ownerId: from.ownerId,
  updatedAt: from.updatedAt,
  use: from.use,
});

export const _fromB64 = (b64: KryptosB64): KryptosDer => {
  return {
    curve: b64.curve,
    privateKey: b64.privateKey ? Buffer.from(b64.privateKey, "base64url") : undefined,
    publicKey: b64.publicKey ? Buffer.from(b64.publicKey, "base64url") : undefined,
    type: b64.type,
  };
};

export const _fromDer = (der: KryptosDer): KryptosDer => {
  return {
    curve: der.curve,
    privateKey: der.privateKey,
    publicKey: der.publicKey,
    type: der.type,
  };
};

export const _fromJwk = (jwk: KryptosFromJwk): KryptosDer => {
  switch (jwk.kty) {
    case "EC":
      return _createEcDerFromJwk(jwk as EcKeyJwk);

    case "oct":
      return _createOctDerFromJwk(jwk as OctKeyJwk);

    case "OKP":
      return _createOkpDerFromJwk(jwk as OkpKeyJwk);

    case "RSA":
      return _createRsaDerFromJwk(jwk as RsaKeyJwk);

    default:
      throw new KryptosError("Invalid key type", { data: { valid: TYPES } });
  }
};

export const _fromPem = (pem: KryptosPem): KryptosDer => {
  switch (pem.type) {
    case "EC":
      return _createEcDerFromPem(pem);

    case "oct":
      return _createOctDerFromPem(pem);

    case "OKP":
      return _createOkpDerFromPem(pem);

    case "RSA":
      return _createRsaDerFromPem(pem);

    default:
      throw new KryptosError("Invalid key type", { data: { valid: TYPES } });
  }
};

export const _fromRaw = (raw: KryptosRaw): KryptosDer => {
  switch (raw.type) {
    case "EC":
      return _createEcDerFromRaw(raw);

    case "oct":
    case "OKP":
    case "RSA":
      throw new KryptosError("Raw import not supported for this key type");

    default:
      throw new KryptosError("Invalid key type", { data: { valid: TYPES } });
  }
};

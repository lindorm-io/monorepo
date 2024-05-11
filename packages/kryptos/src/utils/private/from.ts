import { KryptosError } from "../../errors";
import {
  EcKeyJwk,
  KryptosB64,
  KryptosDer,
  KryptosFromJwk,
  KryptosOptions,
  KryptosPem,
  KryptosRaw,
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

export const _fromB64 = (b64: KryptosB64): KryptosOptions => {
  return {
    curve: b64.curve,
    privateKey: b64.privateKey ? Buffer.from(b64.privateKey, "base64url") : undefined,
    publicKey: b64.publicKey ? Buffer.from(b64.publicKey, "base64url") : undefined,
    type: b64.type,
  };
};

export const _fromJwk = (jwk: KryptosFromJwk): KryptosOptions => {
  let der: KryptosDer;

  switch (jwk.kty) {
    case "EC":
      der = _createEcDerFromJwk(jwk as EcKeyJwk);
      break;

    case "oct":
      der = _createOctDerFromJwk(jwk as OctKeyJwk);
      break;

    case "OKP":
      der = _createOkpDerFromJwk(jwk as OkpKeyJwk);
      break;

    case "RSA":
      der = _createRsaDerFromJwk(jwk as RsaKeyJwk);
      break;

    default:
      throw new KryptosError("Invalid key type", { data: { valid: TYPES } });
  }

  return {
    id: jwk.kid,
    algorithm: jwk.alg,
    createdAt: jwk.iat ? new Date(jwk.iat * 1000) : undefined,
    curve: der.curve,
    expiresAt: jwk.exp ? new Date(jwk.exp * 1000) : undefined,
    isExternal: true,
    jwksUri: jwk.jku,
    notBefore: jwk.nbf ? new Date(jwk.nbf * 1000) : undefined,
    operations: jwk.key_ops ? jwk.key_ops : undefined,
    ownerId: jwk.owner_id,
    privateKey: der.privateKey,
    publicKey: der.publicKey,
    type: der.type,
    updatedAt: jwk.uat ? new Date(jwk.uat * 1000) : undefined,
    use: jwk.use,
  };
};

export const _fromPem = (pem: KryptosPem): KryptosOptions => {
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

export const _fromRaw = (raw: KryptosRaw): KryptosOptions => {
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

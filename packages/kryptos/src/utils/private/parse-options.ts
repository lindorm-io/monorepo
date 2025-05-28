import { ChangeCase, changeKeys } from "@lindorm/case";
import { KryptosError } from "../../errors";
import { KryptosOptions, KryptosPurpose, KryptosType, UnknownJwk } from "../../types";

const TYPES: Array<KryptosType> = ["EC", "oct", "OKP", "RSA"] as const;

export const parseJwkOptions = (options: UnknownJwk): KryptosOptions => {
  const jwk = changeKeys(options, ChangeCase.Snake);

  if (!TYPES.includes(jwk.kty)) {
    throw new KryptosError("Invalid key type", { data: { valid: TYPES } });
  }

  return {
    id: jwk.kid,
    algorithm: jwk.alg,
    createdAt: jwk.iat ? new Date(jwk.iat * 1000) : undefined,
    encryption: jwk.enc,
    expiresAt: jwk.exp ? new Date(jwk.exp * 1000) : undefined,
    isExternal: true,
    issuer: jwk.iss,
    jwksUri: jwk.jku,
    notBefore: jwk.nbf ? new Date(jwk.nbf * 1000) : undefined,
    operations: jwk.key_ops,
    ownerId: jwk.owner_id,
    purpose: jwk.purpose as KryptosPurpose,
    type: jwk.kty,
    updatedAt: jwk.uat ? new Date(jwk.uat * 1000) : undefined,
    use: jwk.use,
  };
};

type Options = Omit<KryptosOptions, "curve" | "privateKey" | "publicKey">;

export const parseStdOptions = (options: Options): KryptosOptions => ({
  id: options.id,
  algorithm: options.algorithm,
  createdAt: options.createdAt,
  encryption: options.encryption,
  expiresAt: options.expiresAt,
  hidden: options.hidden,
  issuer: options.issuer,
  jwksUri: options.jwksUri,
  notBefore: options.notBefore,
  operations: options.operations,
  ownerId: options.ownerId,
  purpose: options.purpose,
  type: options.type,
  updatedAt: options.updatedAt,
  use: options.use,
});

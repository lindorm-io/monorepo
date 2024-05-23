import { ChangeCase, changeKeys } from "@lindorm/case";
import { KryptosError } from "../../errors";
import { KryptosOptions, KryptosType, UnknownJwk } from "../../types";

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
    expiresAt: jwk.exp ? new Date(jwk.exp * 1000) : undefined,
    isExternal: true,
    issuer: jwk.iss,
    jwksUri: jwk.jku,
    notBefore: jwk.nbf ? new Date(jwk.nbf * 1000) : undefined,
    operations: jwk.key_ops,
    ownerId: jwk.owner_id,
    updatedAt: jwk.uat ? new Date(jwk.uat * 1000) : undefined,
    use: jwk.use,
    type: jwk.kty,
  };
};

type Options = Omit<KryptosOptions, "curve" | "privateKey" | "publicKey">;

export const parseStdOptions = (options: Options): KryptosOptions => ({
  id: options.id,
  algorithm: options.algorithm,
  createdAt: options.createdAt,
  expiresAt: options.expiresAt,
  issuer: options.issuer,
  jwksUri: options.jwksUri,
  notBefore: options.notBefore,
  operations: options.operations,
  ownerId: options.ownerId,
  updatedAt: options.updatedAt,
  use: options.use,
  type: options.type,
});

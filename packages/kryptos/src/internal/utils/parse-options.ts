import { KryptosError } from "../../errors";
import {
  KryptosJwk,
  KryptosOperation,
  KryptosOptions,
  KryptosType,
  UnknownJwk,
} from "../../types";

const TYPES: Array<KryptosType> = ["EC", "oct", "OKP", "RSA"] as const;

type LooseJwk = UnknownJwk &
  Partial<KryptosJwk> & {
    keyOps?: Array<KryptosOperation>;
    ownerId?: string;
  };

export const parseJwkOptions = (
  options: UnknownJwk & Partial<KryptosJwk>,
): KryptosOptions => {
  const jwk = options as LooseJwk;

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
    operations: jwk.key_ops ?? jwk.keyOps,
    ownerId: jwk.owner_id ?? jwk.ownerId,
    purpose: jwk.purpose,
    type: jwk.kty,
    use: jwk.use,
    certificateChain: jwk.x5c ?? [],
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
  use: options.use,
  certificateChain: options.certificateChain,
});

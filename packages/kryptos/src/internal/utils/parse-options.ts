import { KryptosError } from "../../errors/index.js";
import type {
  KryptosJwk,
  KryptosOptions,
  KryptosType,
  UnknownJwk,
} from "../../types/index.js";

const TYPES: Array<KryptosType> = ["AKP", "EC", "oct", "OKP", "RSA"] as const;

type LooseJwk = UnknownJwk &
  Partial<KryptosJwk> & {
    ownerId?: string;
  };

export const parseJwkOptions = (
  options: UnknownJwk & Partial<KryptosJwk>,
): KryptosOptions => {
  const jwk = options as LooseJwk;

  if (!TYPES.includes(jwk.kty)) {
    throw new KryptosError("Invalid key type", {
      code: "unsupported_key_type",
      title: "Unsupported Key Type",
      details: `The JWK key type "${String(jwk.kty)}" is not one of the supported types: ${TYPES.join(", ")}.`,
      data: { kty: jwk.kty, valid: TYPES },
    });
  }

  return {
    id: jwk.kid,
    algorithm: jwk.alg,
    createdAt: jwk.iat ? new Date(jwk.iat * 1000) : undefined,
    encryption: jwk.enc,
    expiresAt: jwk.exp ? new Date(jwk.exp * 1000) : undefined,
    // Present only in private JWKs; legacy/public JWKs default to not-hidden.
    hidden: jwk.hidden ?? false,
    // Deliberately NOT read from the payload (a remote JWKS could plant
    // `isExternal: false`). Ownership is decided by the import path — see
    // KryptosKit.fromJwk, which overrides this default for own-key paths.
    isExternal: true,
    issuer: jwk.iss,
    jwksUri: jwk.jku,
    notBefore: jwk.nbf ? new Date(jwk.nbf * 1000) : undefined,
    // An incoming `key_ops` is DELIBERATELY ignored: `operations` is a derived
    // capability of the key material (see `Kryptos.operations`), so we re-derive
    // it rather than trust the payload. A contradictory key_ops from a remote
    // party is not our failure and must never throw.
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
  ownerId: options.ownerId,
  purpose: options.purpose,
  type: options.type,
  use: options.use,
  certificateChain: options.certificateChain,
});

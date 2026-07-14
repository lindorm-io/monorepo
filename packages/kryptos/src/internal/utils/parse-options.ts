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
    // ⚠ TRUE here, deliberately — and it is the INVERSE of the Kryptos constructor
    // default (`false`, because a key we mint is unpublished until we say so). Do
    // NOT harmonise the two.
    //
    // We emit `publish` only in PRIVATE JWKs, so a key imported from a remote JWKS
    // arrives with the member absent. Amphora filters `publish: true` by default,
    // so defaulting an imported key to `false` would make every EXTERNAL
    // verification key invisible to `find()` — foreign-issuer verification would
    // silently break. And it is semantically right: a JWK is the interchange format
    // of a PUBLISHED key. That is what the format is for.
    //
    // Same seam as `internal` below (default here, overridden by the import path
    // in KryptosKit.fromJwk); our own env strings always carry the member
    // explicitly, so this default never applies to them.
    publish: jwk.publish ?? true,
    // ⚠ FALSE here, deliberately — the INVERSE of the Kryptos constructor default
    // (`true`, because a key we mint is ours). Do NOT harmonise the two, for the
    // same reason as `publish` above: the JWK path is where FOREIGN key material
    // arrives, so its defaults describe a foreign key, not a minted one.
    //
    // ⚠⚠ And it is HARDCODED, never `jwk.internal ?? …` — the payload does not get
    // a vote. A remote JWKS could otherwise plant `internal: true` and pass its key
    // off as one of ours. Provenance is a property of HOW the key arrived, so only
    // the import path may decide it — see KryptosKit.fromJwk, which overrides this
    // default to `true` for the own-key paths (env.import).
    //
    // Together the two defaults make a key from someone's JWKS `{ internal: false,
    // publish: true }`: not ours, and a published artifact. That pair is what keeps
    // remote verification keys both correctly attributed and visible to `find()`.
    internal: false,
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
  // Carried through, unlike on the JWK path: these are OUR OWN structured options
  // (b64/der/pem/utf/derive — and `from.db`, which routes through b64), not a
  // foreign payload, so an explicit value is intent rather than a plant. It is what
  // lets a stored key round-trip its provenance: `toDB` writes the column, and
  // without this `from.db` would silently relabel a foreign key as one of ours.
  // Absent ⇒ the constructor default (`true`), which is right for every own-key path.
  internal: options.internal,
  issuer: options.issuer,
  jwksUri: options.jwksUri,
  notBefore: options.notBefore,
  ownerId: options.ownerId,
  publish: options.publish,
  purpose: options.purpose,
  type: options.type,
  use: options.use,
  certificateChain: options.certificateChain,
});

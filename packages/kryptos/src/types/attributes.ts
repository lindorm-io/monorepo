import type { KryptosAlgClass } from "./alg-class.js";
import type { KryptosAlgorithm } from "./algorithm.js";
import type { KryptosCurve } from "./curve.js";
import type { KryptosEncryption } from "./encryption.js";
import type { RsaModulus } from "./key-types/index.js";
import type { KryptosOperation } from "./operation.js";
import type { KryptosType, KryptosUse } from "./types.js";

export type KryptosAttributes = {
  id: string;
  algorithm: KryptosAlgorithm;
  certificateChain: Array<string>;
  createdAt: Date;
  curve: KryptosCurve | null;
  encryption: KryptosEncryption | null;
  expiresAt: Date;
  // Is this OUR key material? A STORED fact about PROVENANCE, and it defaults to
  // TRUE: a key we mint, derive or import from our own env is ours. It goes FALSE
  // only for key material someone handed us — in practice a remote JWKS.
  //
  // ⚠ Provenance is decided by the IMPORT PATH, never by the payload. `from.jwk`
  // defaults it to FALSE and `parseJwkOptions` refuses to read it off the JWK, so
  // a remote JWKS cannot plant `internal: true` and masquerade as one of our keys.
  internal: boolean;
  issuer: string | null;
  jwksUri: string | null;
  notBefore: Date;
  ownerId: string | null;
  // Does this key belong in the published JWKS? A STORED policy choice, not a
  // derived fact — and it defaults to FALSE: a key we MINT is unpublished until
  // someone says otherwise. The harms are asymmetric. Publishing a key that
  // should have stayed internal (KEK, CA, cookie/session) is a SILENT exposure;
  // failing to publish one that should be public is a LOUD, instant failure —
  // relying parties cannot verify and you know within seconds. So publication is
  // opted INTO. The one exception is `from.jwk`, which defaults TRUE: a JWK is
  // the interchange format of an already-published key.
  publish: boolean;
  purpose: string | null;
  type: KryptosType;
  use: KryptosUse;
};

export type KryptosMetadata = {
  // Asymmetric or symmetric, derived from `type` — see `Kryptos.algClass`.
  algClass: KryptosAlgClass;
  certificateThumbprint: string | null;
  expiresIn: number;
  hasCertificate: boolean;
  hasPrivateKey: boolean;
  hasPublicKey: boolean;
  // pending → active → expired: mutually exclusive, exhaustive. Named in full
  // so a consumer can state a TIME policy as a predicate and enforce it on a
  // key it was handed as well as one it queried.
  isActive: boolean;
  isExpired: boolean;
  isPending: boolean;
  modulus: RsaModulus | null;
  // Derived from the key material, never stored — see `Kryptos.operations`.
  operations: Array<KryptosOperation>;
  thumbprint: string;
};

export type KryptosJSON = KryptosAttributes & KryptosMetadata;

export type KryptosDB = KryptosAttributes & {
  privateKey: string | null | undefined;
  publicKey: string | null | undefined;
};

export type KryptosLike = Partial<KryptosAttributes>;

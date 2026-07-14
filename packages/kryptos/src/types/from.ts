import type { IKryptos } from "../interfaces/index.js";
import type { KryptosAttributes } from "./attributes.js";
import type { UnknownJwk } from "./jwk.js";
import type { KryptosBuffer, KryptosJwk, KryptosString } from "./kryptos.js";
import type { KryptosOptions } from "./options.js";

type Std = Omit<
  KryptosOptions,
  "algorithm" | "curve" | "privateKey" | "publicKey" | "type" | "use"
>;

export type KryptosFromDb = KryptosAttributes & {
  privateKey: string | null;
  publicKey: string | null;
};

// `id` comes from `Std` (optional) on every import path: an explicit id always
// wins, and absent one the Kryptos constructor derives it from the key material
// (thumbprint for asymmetric keys, random for oct). It is required on the EXPORT
// shapes (`KryptosString` / `KryptosBuffer`) — by then it always exists.
export type KryptosFromString = Std & Omit<KryptosString, "id">;

export type KryptosFromBuffer = Std & Omit<KryptosBuffer, "id">;

export type KryptosFromDerive = Std &
  // `id` comes from `Std` (optional): with a `path` and no explicit `id`, the id
  // is derived deterministically from the same HKDF stream so a re-derived key
  // reproduces its id too (ciphertexts embed the key id).
  Omit<KryptosString, "id" | "privateKey" | "publicKey"> & {
    // A UTF-8 passphrase (legacy: IKM = utf8 bytes) or an oct seed key (IKM =
    // its raw private key bytes). HKDF-SHA256, empty salt — deterministic.
    deriveFrom: string | IKryptos;
    // Optional derivation path (e.g. `urn:lindorm:tyr:kek:v1`). When set, the
    // HKDF `info` becomes `<path>:<algorithm>`; otherwise the legacy
    // `lindorm:oct:<algorithm>`. Bumping the version in the path rotates the key.
    path?: string;
  };

export type KryptosFromJwk = UnknownJwk & Partial<KryptosJwk>;

export type KryptosFrom =
  | KryptosFromString
  | KryptosFromBuffer
  | KryptosFromDerive
  | KryptosFromJwk
  | string;

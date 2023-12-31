import { KeySetAlgorithm } from "./algorithms";
import { KeySetJwk } from "./key-set";

export type JwkOperations =
  | "decrypt"
  | "deriveBits"
  | "deriveKey"
  | "encrypt"
  | "sign"
  | "unwrapKey"
  | "verify"
  | "wrapKey";

export type JwkType = "EC" | "RSA" | "OKP" | "oct";

export type JwkUsage = "enc" | "sig";

export type JwkMetadata = {
  alg: KeySetAlgorithm;
  kid: string;
  kty: JwkType;
  use: JwkUsage;

  // specific for private keys
  key_ops: Array<JwkOperations>;
};

export type LindormJwkMetadata = {
  created_at: number;
  expires_at?: number;
  jwk_uri?: string;
  not_before: number;
  owner_id?: string;
};

export type PublicJwk = KeySetJwk & JwkMetadata;

export type LindormJwk = PublicJwk & LindormJwkMetadata;

export type ExternalJwk = PublicJwk & Partial<LindormJwk>;

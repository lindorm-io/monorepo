import type { KryptosJwk } from "../../types/kryptos.js";
import type { ParsedX509Certificate } from "../../types/x509.js";

export type CachedKeys = Readonly<{ privateKey?: string; publicKey?: string }>;
export type CachedJwkKeys = Readonly<Omit<KryptosJwk, "kid" | "alg" | "kty" | "use">>;

export type ExportCache = {
  jwkPrivate?: CachedJwkKeys;
  jwkPublic?: CachedJwkKeys;
  pem?: CachedKeys;
  b64?: CachedKeys;
  parsedLeaf?: ParsedX509Certificate;
};

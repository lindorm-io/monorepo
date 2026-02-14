import { KryptosJwk } from "../kryptos";

export type CachedKeys = Readonly<{ privateKey?: string; publicKey?: string }>;
export type CachedJwkKeys = Readonly<Omit<KryptosJwk, "kid" | "alg" | "kty" | "use">>;

export type ExportCache = {
  jwkPrivate?: CachedJwkKeys;
  jwkPublic?: CachedJwkKeys;
  pem?: CachedKeys;
  b64?: CachedKeys;
};

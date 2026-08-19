import type { KryptosJwk } from "../../types/kryptos.js";
import type { ParsedX509Certificate } from "../../types/x509.js";

export type CachedKeys = Readonly<{ privateKey?: string; publicKey?: string }>;
export type CachedJwkKeys = Readonly<Omit<KryptosJwk, "kid" | "alg" | "kty" | "use">>;

// The certificate facts derived from the chain: its base64 spelling and both
// leaf digests. Derived once per instance — the chain is immutable — so a caller
// that reads a thumbprint on every mint does not re-hash the leaf each time.
// `ders` is the instance's own buffer list; `certificate()` copies out of it.
export type CachedCertificate = Readonly<{
  ders: ReadonlyArray<Buffer>;
  chain: ReadonlyArray<string>;
  thumbprint: string;
  thumbprintSha1: string;
}>;

export type ExportCache = {
  jwkPrivate?: CachedJwkKeys;
  jwkPublic?: CachedJwkKeys;
  pem?: CachedKeys;
  b64?: CachedKeys;
  certificate?: CachedCertificate;
  // Parsed certificates keyed by chain index; sparse, filled on first read by
  // `Kryptos.parseCertificate`.
  parsedCertificates?: Array<ParsedX509Certificate | undefined>;
};

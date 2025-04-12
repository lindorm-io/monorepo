import { KryptosAlgorithm, KryptosEncryption } from "@lindorm/kryptos";

export type CoseItem<K = string> = {
  key: K;
  label: number;
  array?: boolean;
  bstr?: boolean;
  json?: boolean;
};

const array = true;
const bstr = true;

// 400 is mapped to Lindorm Kryptos Algorithms
// 500 is mapped to Lindorm Token Payload Claims
// 600 is mapped to Lindorm Kryptos Encryption
// 700 is mapped to Lindorm Token Header Claims

export const COSE_ALGORITHM: Array<CoseItem<KryptosAlgorithm | KryptosEncryption>> = [
  // RFC Encryption
  { key: "dir", label: -6 },
  { key: "A128KW", label: -3 },
  { key: "A192KW", label: -4 },
  { key: "A256KW", label: -5 },
  { key: "ECDH-ES", label: -25 },
  { key: "ECDH-ES+A128KW", label: -29 },
  { key: "ECDH-ES+A192KW", label: -30 },
  { key: "ECDH-ES+A256KW", label: -31 },

  // Lindorm Encryption
  { key: "ECDH-ES+A128GCMKW", label: 401 },
  { key: "ECDH-ES+A192GCMKW", label: 402 },
  { key: "ECDH-ES+A256GCMKW", label: 403 },
  { key: "A128GCMKW", label: 404 },
  { key: "A192GCMKW", label: 405 },
  { key: "A256GCMKW", label: 406 },

  // RFC Signatures
  { key: "EdDSA", label: -8 },
  { key: "ES256", label: -7 },
  { key: "ES384", label: -35 },
  { key: "ES512", label: -36 },
  { key: "HS256", label: 5 },
  { key: "HS384", label: 6 },
  { key: "HS512", label: 7 },
  { key: "PS256", label: -37 },
  { key: "PS384", label: -38 },
  { key: "PS512", label: -39 },
  { key: "RS256", label: -257 },
  { key: "RS384", label: -258 },
  { key: "RS512", label: -259 },
] as const;

export const COSE_CLAIMS: Array<CoseItem> = [
  // RFC
  { key: "iss", label: 1 },
  { key: "sub", label: 2 },
  { key: "aud", label: 3 },
  { key: "exp", label: 4 },
  { key: "nbf", label: 5 },
  { key: "iat", label: 6 },
  { key: "jti", label: 7, bstr }, // translated from "cti"
  { key: "scope", label: 9, bstr, array },
  { key: "nonce", label: 10, bstr },

  // Lindorm
  { key: "aal", label: 500 },
  { key: "afr", label: 501, bstr },
  { key: "cid", label: 502, bstr },
  { key: "gty", label: 503, bstr },
  { key: "loa", label: 504 },
  { key: "per", label: 505 },
  { key: "rls", label: 506 },
  { key: "sid", label: 507, bstr },
  { key: "sih", label: 508, bstr },
  { key: "suh", label: 509, bstr },
  { key: "tid", label: 510, bstr },
  { key: "token_type", label: 511, bstr },
] as const;

export const COSE_ENCRYPTION: Array<CoseItem<KryptosAlgorithm | KryptosEncryption>> = [
  // RFC Encryption
  { key: "A128GCM", label: 1 },
  { key: "A192GCM", label: 2 },
  { key: "A256GCM", label: 3 },

  // Lindorm Encryption
  { key: "A128CBC-HS256", label: 600 },
  { key: "A192CBC-HS384", label: 601 },
  { key: "A256CBC-HS512", label: 602 },
] as const;

export const COSE_HEADER: Array<CoseItem> = [
  // RFC
  { key: "alg", label: 1 },
  { key: "c5b", label: 24 },
  { key: "c5c", label: 25 },
  { key: "c5t", label: 22 },
  { key: "c5u", label: 23 },
  { key: "crit", label: 2 },
  { key: "cty", label: 3 },
  { key: "enc", label: 1 }, // overwrites "alg"
  { key: "epk", label: -1 },
  { key: "hkdf_salt", label: -20 }, // translated from "salt"
  { key: "iv", label: 5 },
  { key: "kid", label: 4, bstr },
  { key: "typ", label: 16 },
  { key: "x5c", label: 33 },
  { key: "x5t", label: 34 },
  { key: "x5u", label: 35 },

  // Lindorm
  { key: "jku", label: 701 },
  { key: "jwk", label: 702 },
  { key: "oid", label: 703, bstr },
  { key: "p2c", label: 704 },
  { key: "p2s", label: 705 },
  { key: "tag", label: 706 },
] as const;

export const COSE_KEY: Array<CoseItem> = [
  // RFC
  { key: "alg", label: 3 },
  { key: "iv", label: 5 },
  { key: "key_ops", label: 4, array },
  { key: "kid", label: 2, bstr },
  { key: "kty", label: 1 },
] as const;

export const COSE_KEY_EC: Array<CoseItem> = [
  { key: "crv", label: -1 },
  { key: "d", label: -4, bstr },
  { key: "x", label: -2, bstr },
  { key: "y", label: -3, bstr },
] as const;

export const COSE_KEY_OKP: Array<CoseItem> = [
  { key: "crv", label: -1 },
  { key: "d", label: -4, bstr },
  { key: "x", label: -2, bstr },
] as const;

export const COSE_KEY_RSA: Array<CoseItem> = [
  { key: "d", label: -3, bstr },
  { key: "e", label: -2, bstr },
  { key: "n", label: -1, bstr },
  { key: "p", label: -4, bstr },
  { key: "q", label: -5, bstr },
  { key: "dp", label: -6, bstr },
  { key: "dq", label: -7, bstr },
  { key: "qi", label: -8, bstr },
] as const;

export const COSE_KEY_OCT: Array<CoseItem> = [{ key: "k", label: -1 }] as const;

export const COSE_KEY_CURVE: Array<CoseItem> = [
  { key: "P-256", label: 1 },
  { key: "P-384", label: 2 },
  { key: "P-521", label: 3 },
  { key: "X25519", label: 4 },
  { key: "X448", label: 5 },
  { key: "Ed25519", label: 6 },
  { key: "Ed448", label: 7 },
] as const;

export const COSE_KEY_TYPE: Array<CoseItem> = [
  { key: "EC", label: 2 },
  { key: "OKP", label: 1 },
  { key: "RSA", label: 3 },
  { key: "oct", label: 4 },
] as const;

export const CBC_ENCRYPTION_ALGORITHMS = [
  "A128CBC-HS256",
  "A192CBC-HS384",
  "A256CBC-HS512",
] as const;

export const GCM_ENCRYPTION_ALGORITHMS = ["A128GCM", "A192GCM", "A256GCM"] as const;

/**
 * COSE AES-CCM content-encryption algorithms (RFC 9053 §4.2). The name encodes
 * `AES-CCM-{L}-{tagBits}-{keyBits}`: `L` 16 ⇒ 13-byte nonce, 64 ⇒ 7-byte nonce;
 * tag 64 ⇒ 8 bytes, 128 ⇒ 16 bytes; key 128/256 only (COSE defines no 192-bit
 * CCM). Used by constrained-device COSE/CWT and mdoc (ISO 18013-5).
 */
export const CCM_ENCRYPTION_ALGORITHMS = [
  "AES-CCM-16-64-128",
  "AES-CCM-16-64-256",
  "AES-CCM-64-64-128",
  "AES-CCM-64-64-256",
  "AES-CCM-16-128-128",
  "AES-CCM-16-128-256",
  "AES-CCM-64-128-128",
  "AES-CCM-64-128-256",
] as const;

export const AES_ENCRYPTION_ALGORITHMS = [
  ...CBC_ENCRYPTION_ALGORITHMS,
  ...GCM_ENCRYPTION_ALGORITHMS,
  ...CCM_ENCRYPTION_ALGORITHMS,
] as const;

export type AesCbcEncryption = (typeof CBC_ENCRYPTION_ALGORITHMS)[number];
export type AesGcmEncryption = (typeof GCM_ENCRYPTION_ALGORITHMS)[number];
export type AesCcmEncryption = (typeof CCM_ENCRYPTION_ALGORITHMS)[number];
export type AesEncryption = (typeof AES_ENCRYPTION_ALGORITHMS)[number];

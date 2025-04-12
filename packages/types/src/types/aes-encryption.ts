export const CBC_ENCRYPTION_ALGORITHMS = [
  "A128CBC-HS256",
  "A192CBC-HS384",
  "A256CBC-HS512",
] as const;

export const GCM_ENCRYPTION_ALGORITHMS = ["A128GCM", "A192GCM", "A256GCM"] as const;

export const AES_ENCRYPTION_ALGORITHMS = [
  ...CBC_ENCRYPTION_ALGORITHMS,
  ...GCM_ENCRYPTION_ALGORITHMS,
] as const;

export type AesCbcEncryption = (typeof CBC_ENCRYPTION_ALGORITHMS)[number];
export type AesGcmEncryption = (typeof GCM_ENCRYPTION_ALGORITHMS)[number];
export type AesEncryption = (typeof AES_ENCRYPTION_ALGORITHMS)[number];

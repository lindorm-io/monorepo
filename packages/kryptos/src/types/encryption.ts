export const CBC_ENCRYPTION_ALGORITHMS = [
  "A128CBC-HS256",
  "A192CBC-HS384",
  "A256CBC-HS512",
] as const;

export const GCM_ENCRYPTION_ALGORITHMS = ["A128GCM", "A192GCM", "A256GCM"] as const;

type CbcEncryption = (typeof CBC_ENCRYPTION_ALGORITHMS)[number];
type GcmEncryption = (typeof GCM_ENCRYPTION_ALGORITHMS)[number];

export type KryptosEncryption = CbcEncryption | GcmEncryption;

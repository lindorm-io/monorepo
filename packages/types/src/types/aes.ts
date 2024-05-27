export type AesKeyLength_A128GCM = 16;
export type AesKeyLength_A192GCM = 24;
export type AesKeyLength_A256GCM = 32;

export type AesKeyLength_A128CBC_HS256 = 48;
export type AesKeyLength_A192CBC_HS384 = 72;
export type AesKeyLength_A256CBC_HS512 = 96;

export type AesKeyLength =
  | AesKeyLength_A128GCM
  | AesKeyLength_A192GCM
  | AesKeyLength_A256GCM
  | AesKeyLength_A128CBC_HS256
  | AesKeyLength_A192CBC_HS384
  | AesKeyLength_A256CBC_HS512;

export type AesCbcEncryption = "A128CBC-HS256" | "A192CBC-HS384" | "A256CBC-HS512";

export type AesGcmEncryption = "A128GCM" | "A192GCM" | "A256GCM";

export type AesEncryption = AesCbcEncryption | AesGcmEncryption;

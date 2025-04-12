export const AES_KEY_LENGTH_A128GCM = 16 as const;
export const AES_KEY_LENGTH_A192GCM = 24 as const;
export const AES_KEY_LENGTH_A256GCM = 32 as const;

export const AES_KEY_LENGTH_A128CBC_HS256 = 48 as const;
export const AES_KEY_LENGTH_A192CBC_HS384 = 72 as const;
export const AES_KEY_LENGTH_A256CBC_HS512 = 96 as const;

export const AES_KEY_LENGTHS = [
  AES_KEY_LENGTH_A128GCM,
  AES_KEY_LENGTH_A192GCM,
  AES_KEY_LENGTH_A256GCM,
  AES_KEY_LENGTH_A128CBC_HS256,
  AES_KEY_LENGTH_A192CBC_HS384,
  AES_KEY_LENGTH_A256CBC_HS512,
] as const;

export type AesKeyLength_A128GCM = typeof AES_KEY_LENGTH_A128GCM;
export type AesKeyLength_A192GCM = typeof AES_KEY_LENGTH_A192GCM;
export type AesKeyLength_A256GCM = typeof AES_KEY_LENGTH_A256GCM;

export type AesKeyLength_A128CBC_HS256 = typeof AES_KEY_LENGTH_A128CBC_HS256;
export type AesKeyLength_A192CBC_HS384 = typeof AES_KEY_LENGTH_A192CBC_HS384;
export type AesKeyLength_A256CBC_HS512 = typeof AES_KEY_LENGTH_A256CBC_HS512;

export type AesKeyLength = (typeof AES_KEY_LENGTHS)[number];

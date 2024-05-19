export type AesKeyLength_128GCM = 16;
export type AesKeyLength_192GCM = 24;
export type AesKeyLength_256GCM = 32;

export type AesKeyLength_128CBC_HS256 = 48;
export type AesKeyLength_192CBC_HS384 = 72;
export type AesKeyLength_256CBC_HS512 = 96;

export type AesKeyLength =
  | AesKeyLength_128GCM
  | AesKeyLength_192GCM
  | AesKeyLength_256GCM
  | AesKeyLength_128CBC_HS256
  | AesKeyLength_192CBC_HS384
  | AesKeyLength_256CBC_HS512;

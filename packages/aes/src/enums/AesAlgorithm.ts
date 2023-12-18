export enum AesAlgorithm {
  // cbc
  AES_128_CBC = "aes-128-cbc",
  AES_192_CBC = "aes-192-cbc",
  AES_256_CBC = "aes-256-cbc",

  // cbc with hmac
  AES_128_CBC_HS256 = "aes-128-cbc-hs256",
  AES_192_CBC_HS256 = "aes-192-cbc-hs256",
  AES_256_CBC_HS256 = "aes-256-cbc-hs256",

  // gcm
  AES_128_GCM = "aes-128-gcm",
  AES_192_GCM = "aes-192-gcm",
  AES_256_GCM = "aes-256-gcm",
}

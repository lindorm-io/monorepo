export type AesCipherAlgorithm = "aes-128-gcm" | "aes-192-gcm" | "aes-256-gcm";

export type AesCipherFormat = "base64" | "base64url" | "hex";

export type AesCipherKey = string | { key: string; passphrase?: string };

export type AesKeyObject = { key: string; passphrase?: string; type: "EC" | "RSA" };

export type AesSecret = Buffer | string;

export type AesEncryptionKey = AesKeyObject;
// export type AesEncryptionKey = JwkValues | AesKeyObject;

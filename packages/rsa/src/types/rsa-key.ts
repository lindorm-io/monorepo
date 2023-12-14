export type RsaPublicKey = string | { key: string };

export type RsaPrivateKey = string | { key: string; passphrase?: string };

export type RsaKey = RsaPublicKey | RsaPrivateKey;

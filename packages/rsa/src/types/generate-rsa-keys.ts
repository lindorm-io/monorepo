export type PublicKeyEncoding = {
  format: "pem";
  type: "pkcs1";
};

export type PrivatePkcs1KeyEncoding = {
  format: "pem";
  type: "pkcs1";
};

export type PrivatePkcs8KeyEncoding = {
  cipher: string;
  format: "pem";
  passphrase: string;
  type: "pkcs8";
};

export type PrivateKeyEncoding = PrivatePkcs1KeyEncoding | PrivatePkcs8KeyEncoding;

export type GenerateRsaKeysOptions = {
  modulus?: 1 | 2 | 3 | 4;
  passphrase?: string;
};

export type GenerateRsaKeysResult = {
  privateKey: string;
  publicKey: string;
};

export type RsaKeySetDer = {
  privateKey?: Buffer;
  publicKey: Buffer;
  keyId?: string;
  type: "RSA";
};

export type RsaKeySetPem = {
  privateKey?: string;
  publicKey: string;
  keyId?: string;
  type: "RSA";
};

export type RsaKeySetJwk = {
  e: string;
  n: string;
  d?: string;
  dp?: string;
  dq?: string;
  p?: string;
  q?: string;
  qi?: string;
  kid?: string;
  kty: "RSA";
};

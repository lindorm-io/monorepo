export type RsaModulusOption = 1 | 2 | 3 | 4;

export type RsaKeySetB64 = {
  id: string;
  privateKey?: string;
  publicKey: string;
  type: "RSA";
};

export type RsaKeySetDer = {
  id: string;
  privateKey?: Buffer;
  publicKey: Buffer;
  type: "RSA";
};

export type RsaKeySetPem = {
  id: string;
  privateKey?: string;
  publicKey: string;
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
  kid: string;
  kty: "RSA";
};

export type RsaModulusSize = 1 | 2 | 3 | 4;

export type RsaKeyJwk = {
  e: string;
  n: string;
  d?: string;
  dp?: string;
  dq?: string;
  p?: string;
  q?: string;
  qi?: string;
  kty: "RSA";
};

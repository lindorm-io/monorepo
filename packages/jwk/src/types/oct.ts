export type OctKeySize = 16 | 24 | 32;

export type OctKeySetDer = {
  privateKey: Buffer;
  keyId?: string;
  type: "oct";
};

export type OctKeySetPem = {
  privateKey: string;
  keyId?: string;
  type: "oct";
};

export type OctKeySetJwk = {
  k: string;
  kid?: string;
  kty: "oct";
};

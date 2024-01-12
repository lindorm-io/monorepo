export type OctKeySize = 16 | 24 | 32;

export type OctKeySetB64 = {
  id: string;
  privateKey: string;
  type: "oct";
};

export type OctKeySetDer = {
  id: string;
  privateKey: Buffer;
  type: "oct";
};

export type OctKeySetPem = {
  id: string;
  privateKey: string;
  type: "oct";
};

export type OctKeySetJwk = {
  k: string;
  kid: string;
  kty: "oct";
};

export type OctetCurve = "Ed25519" | "X25519";

export type OkpKeySetB64 = {
  id: string;
  curve: OctetCurve;
  privateKey?: string;
  publicKey: string;
  type: "OKP";
};

export type OkpKeySetDer = {
  id: string;
  curve: OctetCurve;
  privateKey?: Buffer;
  publicKey: Buffer;
  type: "OKP";
};

export type OkpKeySetPem = {
  id: string;
  curve: OctetCurve;
  privateKey?: string;
  publicKey: string;
  type: "OKP";
};

export type OkpKeySetJwk = {
  crv: OctetCurve;
  d?: string;
  x: string;
  kid: string;
  kty: "OKP";
};

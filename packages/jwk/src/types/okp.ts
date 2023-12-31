export type OctetCurve = "Ed25519" | "X25519";

export type OkpKeySetDer = {
  curve: OctetCurve;
  privateKey?: Buffer;
  publicKey: Buffer;
  keyId?: string;
  type: "OKP";
};

export type OkpKeySetPem = {
  curve: OctetCurve;
  privateKey?: string;
  publicKey: string;
  keyId?: string;
  type: "OKP";
};

export type OkpKeySetJwk = {
  crv: OctetCurve;
  d?: string;
  x: string;
  kid?: string;
  kty: "OKP";
};

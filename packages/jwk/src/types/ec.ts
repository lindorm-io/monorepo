export type NistEllipticCurve = "P-256" | "P-384" | "P-521";

export type SpecificEllipticCurve = "secp256k1" | "secp384r1" | "secp521r1";

export type EllipticCurve = NistEllipticCurve | SpecificEllipticCurve;

export type EcKeySetDer = {
  curve: EllipticCurve;
  privateKey?: Buffer;
  publicKey: Buffer;
  keyId?: string;
  type: "EC";
};

export type EcKeySetPem = {
  curve: EllipticCurve;
  privateKey?: string;
  publicKey: string;
  keyId?: string;
  type: "EC";
};

export type EcKeySetJwk = {
  crv: EllipticCurve;
  d?: string;
  x: string;
  y: string;
  kid?: string;
  kty: "EC";
};

export type EcKeySetRaw = {
  curve: EllipticCurve;
  privateKey?: Buffer;
  publicKey: Buffer;
  keyId?: string;
  type: "EC";
};

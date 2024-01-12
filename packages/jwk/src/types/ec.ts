export type NistEllipticCurve = "P-256" | "P-384" | "P-521";

export type SpecificEllipticCurve = "secp256k1" | "secp384r1" | "secp521r1";

export type EllipticCurve = NistEllipticCurve | SpecificEllipticCurve;

export type EcKeySetB64 = {
  id: string;
  curve: EllipticCurve;
  privateKey?: string;
  publicKey: string;
  type: "EC";
};

export type EcKeySetDer = {
  id: string;
  curve: EllipticCurve;
  privateKey?: Buffer;
  publicKey: Buffer;
  type: "EC";
};

export type EcKeySetPem = {
  id: string;
  curve: EllipticCurve;
  privateKey?: string;
  publicKey: string;
  type: "EC";
};

export type EcKeySetJwk = {
  crv: EllipticCurve;
  d?: string;
  x: string;
  y: string;
  kid: string;
  kty: "EC";
};

export type EcKeySetRaw = {
  id: string;
  curve: EllipticCurve;
  privateKey?: Buffer;
  publicKey: Buffer;
  type: "EC";
};

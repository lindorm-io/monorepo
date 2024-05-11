import { KryptosCurve } from "./types";

export type EcKeyJwk = {
  d?: string;
  x: string;
  y: string;
  crv: KryptosCurve;
  kty: "EC";
};

export type EcCurve = "P-256" | "P-384" | "P-521" | "secp256k1" | "secp384r1" | "secp521r1";

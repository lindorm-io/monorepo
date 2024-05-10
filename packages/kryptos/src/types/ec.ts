import { KryptosCurve } from "./types";

export type EcKeyJwk = {
  d?: string;
  x: string;
  y: string;
  crv: KryptosCurve;
  kty: "EC";
};

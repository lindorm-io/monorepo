import { KryptosCurve, KryptosType } from "./types";

export type OkpKeyJwk = {
  d?: string;
  x: string;
  crv: KryptosCurve;
  kty: KryptosType;
};

export type OkpCurve = "Ed25519" | "Ed448" | "X25519" | "X448";

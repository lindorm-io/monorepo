import { KryptosCurve, KryptosType } from "./types";

export type OkpKeyJwk = {
  d?: string;
  x: string;
  crv: KryptosCurve;
  kty: KryptosType;
};

import { EllipticCurve } from "./types";

export type EcPemValues = {
  curve: EllipticCurve;
  privateKey?: string;
  publicKey: string;
  type: "EC";
};

export type RsaPemValues = {
  passphrase?: string;
  privateKey?: string;
  publicKey: string;
  type: "RSA";
};

export type PemValues = EcPemValues | RsaPemValues;

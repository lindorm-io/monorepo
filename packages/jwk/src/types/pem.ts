import { EllipticCurve } from "./types";

export type EcPemValues = {
  id?: string;
  curve: EllipticCurve;
  privateKey?: string;
  publicKey?: string;
  type: "EC";
};

export type RsaPemValues = {
  id?: string;
  passphrase?: string;
  privateKey?: string;
  publicKey?: string;
  type: "RSA";
};

export type PemValues = EcPemValues | RsaPemValues;

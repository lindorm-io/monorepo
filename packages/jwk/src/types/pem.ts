import { EllipticCurve } from "./types";

export type EcPemValues = {
  id?: string;
  curve: EllipticCurve;
  privateKey?: string;
  publicKey?: string;
  type: "EC";
};

export type OctPemValues = {
  id?: string;
  symmetricKey: string;
  type: "oct";
};

// export type OkpPemValues = {
//   id?: string;
//   curve: string; // Curve name, e.g., "Ed25519"
//   privateKey?: string;
//   publicKey?: string;
//   type: "OKP";
// };

export type RsaPemValues = {
  id?: string;
  passphrase?: string;
  privateKey?: string;
  publicKey?: string;
  type: "RSA";
};

export type PemValues = EcPemValues | OctPemValues | RsaPemValues;

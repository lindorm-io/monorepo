import { AesKeyLength } from "@lindorm/types";
import { KryptosUse } from "../types";

export const OCT_ENC_DIR_ALGORITHMS = ["dir"] as const;

export const OCT_ENC_STD_ALGORITHMS = [
  "A128KW",
  "A192KW",
  "A256KW",
  "A128GCMKW",
  "A192GCMKW",
  "A256GCMKW",
  "PBES2-HS256+A128KW",
  "PBES2-HS384+A192KW",
  "PBES2-HS512+A256KW",
] as const;

export const OCT_STD_SIZES = [64, 96, 128] as const;

export const OCT_SIG_ALGORITHMS = ["HS256", "HS384", "HS512"] as const;

export type OctEncDirAlgorithm = (typeof OCT_ENC_DIR_ALGORITHMS)[number];

export type OctEncStdAlgorithm = (typeof OCT_ENC_STD_ALGORITHMS)[number];

export type OctEncAlgorithm = OctEncDirAlgorithm | OctEncStdAlgorithm;

export type OctSigAlgorithm = (typeof OCT_SIG_ALGORITHMS)[number];

export type OctAlgorithm = OctEncAlgorithm | OctSigAlgorithm;

export type OctDirSize = AesKeyLength;

export type OctStdSize = (typeof OCT_STD_SIZES)[number];

export type OctSize = OctDirSize | OctStdSize;

export type OctString = {
  id: string;
  algorithm: OctAlgorithm;
  privateKey: string;
  type: "oct";
  use: KryptosUse;
};

export type OctBuffer = {
  id: string;
  algorithm: OctAlgorithm;
  privateKey: Buffer;
  type: "oct";
  use: KryptosUse;
};

export type OctJwk = {
  kid: string;
  alg: OctAlgorithm;
  k: string;
  kty: "oct";
  use: KryptosUse;
};

import { AesKeyLength } from "@lindorm/types";
import { KryptosEncryption } from "../encryption";
import { KryptosUse } from "../types";

export type OctEncDirAlgorithm = "dir";

export type OctEncStdAlgorithm =
  | "A128KW"
  | "A192KW"
  | "A256KW"
  | "A128GCMKW"
  | "A192GCMKW"
  | "A256GCMKW"
  | "PBES2-HS256+A128KW"
  | "PBES2-HS384+A192KW"
  | "PBES2-HS512+A256KW";

export type OctEncAlgorithm = OctEncDirAlgorithm | OctEncStdAlgorithm;

export type OctSigAlgorithm = "HS256" | "HS384" | "HS512";

export type OctAlgorithm = OctEncAlgorithm | OctSigAlgorithm;

export type OctDirSize = AesKeyLength;

export type OctStdSize = 64 | 96 | 128;

export type OctSize = OctDirSize | OctStdSize;

export type OctDirGenerateEnc = {
  algorithm: OctEncDirAlgorithm;
  encryption: KryptosEncryption;
  type: "oct";
  use: "enc";
};

export type OctStdGenerateEnc = {
  algorithm: OctEncStdAlgorithm;
  type: "oct";
  use: "enc";
};

export type OctGenerateSig = {
  algorithm: OctSigAlgorithm;
  type: "oct";
  use: "sig";
};

export type OctGenerate = OctDirGenerateEnc | OctStdGenerateEnc | OctGenerateSig;

export type OctString = {
  algorithm: OctAlgorithm;
  privateKey: string;
  publicKey: string; // empty
  type: "oct";
  use: KryptosUse;
};

export type OctDer = {
  algorithm: OctAlgorithm;
  privateKey: Buffer;
  publicKey: Buffer; // empty
  type: "oct";
  use: KryptosUse;
};

export type OctJwk = {
  alg: OctAlgorithm;
  k: string;
  kty: "oct";
  use: KryptosUse;
};

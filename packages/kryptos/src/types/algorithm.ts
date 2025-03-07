import {
  EcEncAlgorithm,
  EcSigAlgorithm,
  OctEncAlgorithm,
  OctSigAlgorithm,
  OkpEncAlgorithm,
  OkpSigAlgorithm,
  RsaEncAlgorithm,
  RsaSigAlgorithm,
} from "./key-types";

export type KryptosEncAlgorithm =
  | EcEncAlgorithm
  | OctEncAlgorithm
  | OkpEncAlgorithm
  | RsaEncAlgorithm;

export type KryptosSigAlgorithm =
  | EcSigAlgorithm
  | OctSigAlgorithm
  | OkpSigAlgorithm
  | RsaSigAlgorithm;

export type KryptosAlgorithm = KryptosEncAlgorithm | KryptosSigAlgorithm;

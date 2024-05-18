import { EcEncAlgorithm, EcSigAlgorithm } from "./ec";
import { OctEncAlgorithm, OctSigAlgorithm } from "./oct";
import { OkpEncAlgorithm, OkpSigAlgorithm } from "./okp";
import { RsaEncAlgorithm, RsaSigAlgorithm } from "./rsa";

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

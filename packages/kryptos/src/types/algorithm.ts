import { EcEncAlgorithm, EcSigAlgorithm } from "./ec";
import { OctEncAlgorithm, OctSigAlgorithm } from "./oct";
import { OkpEncAlgorithm, OkpSigAlgorithm } from "./okp";
import { RsaEncAlgorithm, RsaSigAlgorithm } from "./rsa";

export type JweAlgorithm =
  | EcEncAlgorithm
  | OctEncAlgorithm
  | OkpEncAlgorithm
  | RsaEncAlgorithm;

export type JwtAlgorithm =
  | EcSigAlgorithm
  | OctSigAlgorithm
  | OkpSigAlgorithm
  | RsaSigAlgorithm;

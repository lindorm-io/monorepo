import { EcEncAlgorithm, EcSigAlgorithm } from "./ec";
import { OctEncAlgorithm, OctSigAlgorithm } from "./oct";
import { OkpSigAlgorithm } from "./okp";
import { RsaEncAlgorithm, RsaSigAlgorithm } from "./rsa";

export type JweAlgorithm = EcEncAlgorithm | OctEncAlgorithm | RsaEncAlgorithm;

export type JwtAlgorithm = EcSigAlgorithm | OctSigAlgorithm | OkpSigAlgorithm | RsaSigAlgorithm;

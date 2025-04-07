import { Optional } from "@lindorm/types";
import { KryptosAttributes } from "./attributes";
import { KryptosEncryption } from "./encryption";
import {
  OctEncDirAlgorithm,
  OctEncStdAlgorithm,
  OctSigAlgorithm,
  OkpEncAlgorithm,
  OkpEncCurve,
  OkpSigAlgorithm,
  OkpSigCurve,
  RsaEncAlgorithm,
  RsaSigAlgorithm,
} from "./key-types";
import { EcCurve, EcEncAlgorithm, EcSigAlgorithm } from "./key-types/ec";
import { KryptosEncOperation, KryptosSigOperation } from "./operation";

// default options

type Attributes = Omit<
  KryptosAttributes,
  "algorithm" | "curve" | "encryption" | "operations" | "type" | "use"
>;

type Std = Optional<
  Attributes,
  | "id"
  | "createdAt"
  | "expiresAt"
  | "isExternal"
  | "issuer"
  | "jwksUri"
  | "notBefore"
  | "ownerId"
  | "purpose"
  | "updatedAt"
>;

type Enc = {
  encryption?: KryptosEncryption;
  operations?: Array<KryptosEncOperation>;
};

type Sig = {
  operations?: Array<KryptosSigOperation>;
};

// specific key options

type EcEnc = { algorithm: EcEncAlgorithm; curve?: EcCurve };

type EcSig = { algorithm: EcSigAlgorithm; curve?: EcCurve };

type OctEncDir = { algorithm: OctEncDirAlgorithm };

type OctEncStd = { algorithm: OctEncStdAlgorithm };

type OctEnc = OctEncDir | OctEncStd;

type OctSig = { algorithm: OctSigAlgorithm };

type OkpEnc = { algorithm: OkpEncAlgorithm; curve?: OkpEncCurve };

type OkpSig = { algorithm: OkpSigAlgorithm; curve?: OkpSigCurve };

type RsaEnc = { algorithm: RsaEncAlgorithm };

type RsaSig = { algorithm: RsaSigAlgorithm };

// combined options

export type KryptosGenerateEcEnc = Std & Enc & EcEnc;

export type KryptosGenerateEcSig = Std & Sig & EcSig;

export type KryptosGenerateEc = (KryptosGenerateEcEnc | KryptosGenerateEcSig) & {
  type: "EC";
};

export type KryptosGenerateOctEnc = Std & Enc & OctEnc;

export type KryptosGenerateOctSig = Std & Sig & OctSig;

export type KryptosGenerateOct = (KryptosGenerateOctEnc | KryptosGenerateOctSig) & {
  type: "oct";
};

export type KryptosGenerateOkpEnc = Std & Enc & OkpEnc;

export type KryptosGenerateOkpSig = Std & Sig & OkpSig;

export type KryptosGenerateOkp = (KryptosGenerateOkpEnc | KryptosGenerateOkpSig) & {
  type: "OKP";
};

export type KryptosGenerateRsaEnc = Std & Enc & RsaEnc;

export type KryptosGenerateRsaSig = Std & Sig & RsaSig;

export type KryptosGenerateRsa = (KryptosGenerateRsaEnc | KryptosGenerateRsaSig) & {
  type: "RSA";
};

import { Optional } from "@lindorm/types";
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
import { KryptosAttributes } from "./options";

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

export type KryptosMakeEcEnc = Std & Enc & EcEnc;

export type KryptosMakeEcSig = Std & Sig & EcSig;

export type KryptosMakeEc = (KryptosMakeEcEnc | KryptosMakeEcSig) & { type: "EC" };

export type KryptosMakeOctEnc = Std & Enc & OctEnc;

export type KryptosMakeOctSig = Std & Sig & OctSig;

export type KryptosMakeOct = (KryptosMakeOctEnc | KryptosMakeOctSig) & { type: "oct" };

export type KryptosMakeOkpEnc = Std & Enc & OkpEnc;

export type KryptosMakeOkpSig = Std & Sig & OkpSig;

export type KryptosMakeOkp = (KryptosMakeOkpEnc | KryptosMakeOkpSig) & { type: "OKP" };

export type KryptosMakeRsaEnc = Std & Enc & RsaEnc;

export type KryptosMakeRsaSig = Std & Sig & RsaSig;

export type KryptosMakeRsa = (KryptosMakeRsaEnc | KryptosMakeRsaSig) & { type: "RSA" };

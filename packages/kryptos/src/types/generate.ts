import { Optional } from "@lindorm/types";
import { KryptosAttributes } from "./attributes";
import { KryptosCertificateOption } from "./certificate";
import { KryptosEncryption } from "./encryption";
import {
  AkpSigAlgorithm,
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
  | "algorithm"
  | "certificateChain"
  | "curve"
  | "encryption"
  | "operations"
  | "type"
  | "use"
>;

type StdBase = Optional<
  Attributes,
  | "id"
  | "createdAt"
  | "expiresAt"
  | "hidden"
  | "isExternal"
  | "issuer"
  | "jwksUri"
  | "notBefore"
  | "ownerId"
  | "purpose"
>;

type CertifiableStd = StdBase & {
  certificate?: KryptosCertificateOption;
};

type Enc = {
  encryption?: KryptosEncryption;
  operations?: Array<KryptosEncOperation>;
};

type Sig = {
  operations?: Array<KryptosSigOperation>;
};

// specific key options

type AkpSig = { algorithm: AkpSigAlgorithm };

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

export type KryptosGenerateAkpSig = CertifiableStd & Sig & AkpSig;

export type KryptosGenerateAkp = KryptosGenerateAkpSig & {
  type: "AKP";
};

export type KryptosGenerateEcEnc = CertifiableStd & Enc & EcEnc;

export type KryptosGenerateEcSig = CertifiableStd & Sig & EcSig;

export type KryptosGenerateEc = (KryptosGenerateEcEnc | KryptosGenerateEcSig) & {
  type: "EC";
};

export type KryptosGenerateOctEnc = StdBase & Enc & OctEnc;

export type KryptosGenerateOctSig = StdBase & Sig & OctSig;

export type KryptosGenerateOct = (KryptosGenerateOctEnc | KryptosGenerateOctSig) & {
  type: "oct";
};

export type KryptosGenerateOkpEnc = CertifiableStd & Enc & OkpEnc;

export type KryptosGenerateOkpSig = CertifiableStd & Sig & OkpSig;

export type KryptosGenerateOkp = (KryptosGenerateOkpEnc | KryptosGenerateOkpSig) & {
  type: "OKP";
};

export type KryptosGenerateRsaEnc = CertifiableStd & Enc & RsaEnc;

export type KryptosGenerateRsaSig = CertifiableStd & Sig & RsaSig;

export type KryptosGenerateRsa = (KryptosGenerateRsaEnc | KryptosGenerateRsaSig) & {
  type: "RSA";
};

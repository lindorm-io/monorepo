import { EcAlgorithm, EcB64, EcCurve, EcDer, EcJwk, EcPem } from "./ec";
import { KryptosB64, KryptosDer, KryptosJwk, KryptosPem } from "./export";
import { LindormJwk } from "./jwk";
import { KryptosAttributes, KryptosMetadata } from "./kryptos";
import { OctAlgorithm, OctB64, OctDer, OctJwk, OctPem } from "./oct";
import { OkpAlgorithm, OkpB64, OkpCurve, OkpDer, OkpJwk, OkpPem } from "./okp";
import { RsaAlgorithm, RsaB64, RsaDer, RsaJwk, RsaPem } from "./rsa";
import { KryptosExportMode } from "./types";

export interface IKryptos extends KryptosAttributes, KryptosMetadata {
  toJSON(): KryptosAttributes & KryptosMetadata;
  clone(): IKryptos;
  toJWK(mode?: KryptosExportMode): LindormJwk;

  export(format: "b64"): KryptosB64;
  export(format: "der"): KryptosDer;
  export(format: "jwk"): KryptosJwk;
  export(format: "pem"): KryptosPem;
}

export interface IKryptosEc extends IKryptos {
  algorithm: EcAlgorithm;
  curve: EcCurve;
  type: "EC";

  export(format: "b64"): EcB64;
  export(format: "der"): EcDer;
  export(format: "jwk"): EcJwk;
  export(format: "pem"): EcPem;
}

export interface IKryptosOct extends IKryptos {
  algorithm: OctAlgorithm;
  curve: undefined;
  type: "oct";

  export(format: "b64"): OctB64;
  export(format: "der"): OctDer;
  export(format: "jwk"): OctJwk;
  export(format: "pem"): OctPem;
}

export interface IKryptosOkp extends IKryptos {
  algorithm: OkpAlgorithm;
  curve: OkpCurve;
  type: "OKP";

  export(format: "b64"): OkpB64;
  export(format: "der"): OkpDer;
  export(format: "jwk"): OkpJwk;
  export(format: "pem"): OkpPem;
}

export interface IKryptosRsa extends IKryptos {
  algorithm: RsaAlgorithm;
  curve: undefined;
  type: "RSA";

  export(format: "b64"): RsaB64;
  export(format: "der"): RsaDer;
  export(format: "jwk"): RsaJwk;
  export(format: "pem"): RsaPem;
}

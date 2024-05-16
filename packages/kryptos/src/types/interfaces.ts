import { KryptosClone } from "./clone";
import { EcB64, EcDer, EcJwk, EcPem, EcRaw } from "./ec";
import { KryptosB64, KryptosDer, KryptosJwk, KryptosPem, KryptosRaw } from "./export";
import { LindormJwk } from "./jwk";
import { KryptosAttributes, KryptosMetadata } from "./kryptos";
import { OctB64, OctDer, OctJwk, OctPem } from "./oct";
import { OkpB64, OkpDer, OkpJwk, OkpPem } from "./okp";
import { RsaB64, RsaDer, RsaJwk, RsaPem } from "./rsa";

export interface IKryptos extends KryptosAttributes, KryptosMetadata {
  toJSON(): KryptosAttributes & KryptosMetadata;
  clone(options: KryptosClone): IKryptos;
  toJWK(): LindormJwk;

  export(format: "b64"): KryptosB64;
  export(format: "der"): KryptosDer;
  export(format: "jwk"): KryptosJwk;
  export(format: "pem"): KryptosPem;
  export(format: "raw"): KryptosRaw;
}

export interface IKryptosEc extends IKryptos {
  export(format: "b64"): EcB64;
  export(format: "der"): EcDer;
  export(format: "jwk"): EcJwk;
  export(format: "pem"): EcPem;
  export(format: "raw"): EcRaw;
}

export interface IKryptosOct extends IKryptos {
  export(format: "b64"): OctB64;
  export(format: "der"): OctDer;
  export(format: "jwk"): OctJwk;
  export(format: "pem"): OctPem;
  export(format: "raw"): KryptosRaw;
}

export interface IKryptosOkp extends IKryptos {
  export(format: "b64"): OkpB64;
  export(format: "der"): OkpDer;
  export(format: "jwk"): OkpJwk;
  export(format: "pem"): OkpPem;
  export(format: "raw"): KryptosRaw;
}

export interface KryptosRsa extends IKryptos {
  export(format: "b64"): RsaB64;
  export(format: "der"): RsaDer;
  export(format: "jwk"): RsaJwk;
  export(format: "pem"): RsaPem;
  export(format: "raw"): KryptosRaw;
}

import {
  KryptosAttributes,
  KryptosB64,
  KryptosDer,
  KryptosExportMode,
  KryptosJwk,
  KryptosMetadata,
  KryptosPem,
  LindormJwk,
} from "../types";

export interface IKryptos extends KryptosAttributes, KryptosMetadata {
  toJSON(): KryptosAttributes & KryptosMetadata;
  clone(): IKryptos;
  toJWK(mode?: KryptosExportMode): LindormJwk;

  export(format: "b64"): KryptosB64;
  export(format: "der"): KryptosDer;
  export(format: "jwk"): KryptosJwk;
  export(format: "pem"): KryptosPem;
}

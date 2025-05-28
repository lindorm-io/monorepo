import {
  KryptosAttributes,
  KryptosBuffer,
  KryptosDB,
  KryptosExportMode,
  KryptosJSON,
  KryptosJwk,
  KryptosMetadata,
  KryptosString,
  LindormJwk,
} from "../types";

export interface IKryptos extends KryptosAttributes, KryptosMetadata {
  toDB(): KryptosDB;
  toJSON(): KryptosJSON;
  toJWK(mode?: KryptosExportMode): LindormJwk;
  toString(): string;

  export(format: "b64"): KryptosString;
  export(format: "der"): KryptosBuffer;
  export(format: "jwk"): KryptosJwk;
  export(format: "pem"): KryptosString;
}

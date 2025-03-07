import {
  KryptosAttributes,
  KryptosBuffer,
  KryptosExportMode,
  KryptosJwk,
  KryptosMetadata,
  KryptosString,
  LindormJwk,
} from "../types";

export interface IKryptos extends KryptosAttributes, KryptosMetadata {
  toJSON(): KryptosAttributes & KryptosMetadata;
  toJWK(mode?: KryptosExportMode): LindormJwk;

  export(format: "b64"): KryptosString;
  export(format: "der"): KryptosBuffer;
  export(format: "jwk"): KryptosJwk;
  export(format: "pem"): KryptosString;
}

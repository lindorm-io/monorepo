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
  ParsedX509Certificate,
} from "../types";

export interface IKryptos
  extends Disposable, Readonly<KryptosAttributes>, Readonly<KryptosMetadata> {
  readonly certificate: ParsedX509Certificate | null;

  dispose(): void;

  verifyCertificate(options: { trustAnchors: string | Array<string> }): void;

  toDB(): KryptosDB;
  toEnvString(): string;
  toJSON(): KryptosJSON;
  toJWK(mode?: KryptosExportMode): LindormJwk;
  toString(): string;

  export(format: "b64"): KryptosString;
  export(format: "der"): KryptosBuffer;
  export(format: "jwk"): KryptosJwk;
  export(format: "pem"): KryptosString;
}

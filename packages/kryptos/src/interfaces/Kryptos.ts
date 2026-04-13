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
  readonly thumbprint: string;
  readonly certificateChain: Array<ParsedX509Certificate> | undefined;
  readonly certificateChainPem: string | null;
  readonly x5c: Array<string> | undefined;
  readonly x5t: string | undefined;
  readonly x5tS256: string | undefined;

  dispose(): void;

  verifyCertificateChain(options: { trustAnchors: string | Array<string> }): void;

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

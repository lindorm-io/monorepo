import type {
  KryptosAttributes,
  KryptosBuffer,
  KryptosCertificateB64,
  KryptosCertificateDer,
  KryptosCertificateJwk,
  KryptosCertificatePem,
  KryptosDB,
  KryptosEnvFormat,
  KryptosExportMode,
  KryptosJSON,
  KryptosJwk,
  KryptosMetadata,
  KryptosPem,
  KryptosString,
  LindormJwk,
  ParsedX509Certificate,
} from "../types/index.js";

// Only `certificateChain` is omitted from the INSTANCE surface: the chain is
// certificate MATERIAL, and an instance answers for it through
// `certificate(format)`. `certificateThumbprint` and `hasCertificate` stay — a
// lookup key and a predicate are not accessor paths to the chain, and a vault
// query reads both off an instance. `certificateChain` stays on
// `KryptosAttributes` because that is the serialized shape `toDB()` writes.
export interface IKryptos
  extends
    Disposable,
    Readonly<Omit<KryptosAttributes, "certificateChain">>,
    Readonly<KryptosMetadata> {
  dispose(): void;

  verifyCertificate(options: { trustAnchors: string | Array<string> }): void;

  toDB(): KryptosDB;
  toEnvString(format?: KryptosEnvFormat): string;
  toJSON(): KryptosJSON;
  toJWK(mode?: KryptosExportMode): LindormJwk;
  toString(): string;

  certificate(format: "b64"): KryptosCertificateB64 | null;
  certificate(format: "der"): KryptosCertificateDer | null;
  certificate(format: "jwk"): KryptosCertificateJwk | null;
  certificate(format: "pem"): KryptosCertificatePem | null;

  parseCertificate(index?: number): ParsedX509Certificate | null;

  export(format: "b64"): KryptosString;
  export(format: "der"): KryptosBuffer;
  export(format: "jwk"): KryptosJwk;
  export(format: "pem"): KryptosPem;
}

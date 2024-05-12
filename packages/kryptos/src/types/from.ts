import { KryptosB64, KryptosDer, KryptosJwk, KryptosPem, KryptosRaw } from "./combined";
import { JwkMetadata, LindormJwkMetadata } from "./jwk";
import { KryptosOptions } from "./kryptos";

export type KryptosStdOptions = Omit<KryptosOptions, "curve" | "privateKey" | "publicKey" | "type">;

export type KryptosJwkOptions = Partial<JwkMetadata> & Partial<LindormJwkMetadata>;

export type KryptosFromB64 = KryptosStdOptions & KryptosB64;

export type KryptosFromDer = KryptosStdOptions & KryptosDer;

export type KryptosFromJwk = KryptosJwkOptions & KryptosJwk;

export type KryptosFromPem = KryptosStdOptions & KryptosPem;

export type KryptosFromRaw = KryptosStdOptions & KryptosRaw;

export type KryptosFrom =
  | KryptosFromB64
  | KryptosFromDer
  | KryptosFromJwk
  | KryptosFromPem
  | KryptosFromRaw;

import { KryptosB64, KryptosDer, KryptosJwk, KryptosPem, KryptosRaw } from "./combined";
import { JwkMetadata, LindormJwkMetadata } from "./jwk";
import { KryptosOptions } from "./kryptos";

type StdOptions = Omit<KryptosOptions, "privateKey" | "publicKey">;

type JwkOptions = Partial<JwkMetadata> & Partial<LindormJwkMetadata>;

export type KryptosFromB64 = StdOptions & KryptosB64;

export type KryptosFromDer = StdOptions & KryptosDer;

export type KryptosFromJwk = JwkOptions & KryptosJwk;

export type KryptosFromPem = StdOptions & KryptosPem;

export type KryptosFromRaw = StdOptions & KryptosRaw;

export type KryptosFrom =
  | KryptosFromB64
  | KryptosFromDer
  | KryptosFromJwk
  | KryptosFromPem
  | KryptosFromRaw;

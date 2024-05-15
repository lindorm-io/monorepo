import { KryptosB64, KryptosDer, KryptosJwk, KryptosPem } from "./export";
import { UnknownJwk } from "./jwk";
import { KryptosOptions } from "./kryptos";

type Std = Omit<
  KryptosOptions,
  "algorithm" | "curve" | "privateKey" | "publicKey" | "type" | "use"
>;

export type KryptosFromB64 = Std & KryptosB64;

export type KryptosFromDer = Std & KryptosDer;

export type KryptosFromJwk = UnknownJwk & Partial<KryptosJwk>;

export type KryptosFromPem = Std & KryptosPem;

export type KryptosFromRaw = Std & KryptosDer;

export type KryptosFrom =
  | KryptosFromB64
  | KryptosFromDer
  | KryptosFromJwk
  | KryptosFromPem
  | KryptosFromRaw;

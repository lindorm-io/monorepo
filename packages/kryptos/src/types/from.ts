import { UnknownJwk } from "./jwk";
import { KryptosBuffer, KryptosJwk, KryptosString } from "./kryptos";
import { KryptosOptions } from "./options";

type Std = Omit<
  KryptosOptions,
  "algorithm" | "curve" | "privateKey" | "publicKey" | "type" | "use"
>;

export type KryptosFromString = Std & KryptosString;

export type KryptosFromBuffer = Std & KryptosBuffer;

export type KryptosFromJwk = UnknownJwk & Partial<KryptosJwk>;

export type KryptosFrom = KryptosFromString | KryptosFromBuffer | KryptosFromJwk;

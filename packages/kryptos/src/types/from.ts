import type { KryptosAttributes } from "./attributes.js";
import type { UnknownJwk } from "./jwk.js";
import type { KryptosBuffer, KryptosJwk, KryptosString } from "./kryptos.js";
import type { KryptosOptions } from "./options.js";

type Std = Omit<
  KryptosOptions,
  "algorithm" | "curve" | "privateKey" | "publicKey" | "type" | "use"
>;

export type KryptosFromDb = KryptosAttributes & {
  privateKey: string | null;
  publicKey: string | null;
};

export type KryptosFromString = Std & KryptosString;

export type KryptosFromBuffer = Std & KryptosBuffer;

export type KryptosFromJwk = UnknownJwk & Partial<KryptosJwk>;

export type KryptosFrom = KryptosFromString | KryptosFromBuffer | KryptosFromJwk | string;

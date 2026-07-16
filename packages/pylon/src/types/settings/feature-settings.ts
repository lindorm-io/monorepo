import type { ReadableTime } from "@lindorm/date";
import type { IIrisSource } from "@lindorm/iris";
import type { IEntity, IProteusSource } from "@lindorm/proteus";
import type { Constructor } from "@lindorm/types";
import type { PylonEncKey } from "./keys.js";

export type PylonKryptosSettings = {
  enabled: boolean;
  db?: IProteusSource;
  /**
   * The at-rest KEK selector staged onto `Kryptos.privateKey` before the source
   * sets up. Proteus encrypts the stored private key on write and decrypts it
   * transparently on read. Default `{ predicate: { purpose: "pylon:kek" } }` —
   * the bootstrap key-encryption-key. Same `{ kryptos?, predicate? }` descriptor
   * as every other key surface; `encryption` (the AEAD) is ignored on this path.
   */
  encryption?: PylonEncKey;
};

export type PylonQueueSettings = {
  enabled: boolean;
  bus?: IIrisSource;
};

export type PylonWebhookSettings = {
  enabled: boolean;
  db?: IProteusSource;
  bus?: IIrisSource;
  /**
   * The at-rest KEK selector staged onto `WebhookSubscription.clientSecret`
   * before the source sets up. Proteus encrypts the stored secret on write and
   * decrypts it transparently on read — a subscription registers a PLAINTEXT
   * secret and dispatch reads it back in the clear (no manual decrypt). Default
   * `{ predicate: { purpose: "pylon:kek" } }` — the same bootstrap KEK as kryptos;
   * override it (e.g. its own `purpose`) for a separate blast radius. Same
   * `{ kryptos?, predicate? }` descriptor as every other key surface;
   * `encryption` (the AEAD) is ignored on this path.
   */
  encryption?: PylonEncKey;
  maxErrors?: number;
};

export type PylonCacheSettings = {
  enabled: boolean;
  kv?: IProteusSource;
};

export type PylonRateLimitSettings = {
  enabled: boolean;
  kv?: IProteusSource;
  strategy?: "fixed" | "sliding" | "token-bucket";
  window?: ReadableTime | number;
  max?: number;
  key?: (ctx: any) => string;
  skip?: (ctx: any) => boolean;
};

export type PylonAuditSettings = {
  enabled: boolean;
  db?: IProteusSource;
  bus?: IIrisSource;
  sanitise?: (body: unknown) => unknown;
  skip?: (ctx: any) => boolean;
  entities?: Array<Constructor<IEntity>>;
};

export type PylonRoomsSettings = {
  presence?: boolean;
  kv?: IProteusSource;
};

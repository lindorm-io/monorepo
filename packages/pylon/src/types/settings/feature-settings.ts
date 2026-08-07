import type { ReadableTime } from "@lindorm/date";
import type { IEntity } from "@lindorm/proteus";
import type { Constructor } from "@lindorm/types";
import type { PylonEncKey } from "./keys.js";

export type PylonKryptosSettings = {
  enabled: boolean;
  /**
   * The at-rest KEK selector staged onto `Kryptos.privateKey` before the source
   * sets up. Proteus encrypts the stored private key on write and decrypts it
   * transparently on read. Default `{ condition: { purpose: "pylon:kek" } }` —
   * the bootstrap key-encryption-key. Same `{ kryptos?, condition? }` descriptor
   * as every other key surface; `encryption` (the AEAD) is ignored on this path.
   */
  encryption?: PylonEncKey;
};

export type PylonQueueSettings = {
  enabled: boolean;
};

export type PylonWebhookSettings = {
  enabled: boolean;
  /**
   * The at-rest KEK selector staged onto `WebhookSubscription.clientSecret` and
   * `WebhookSubscription.password` before the source sets up. Proteus encrypts
   * the stored secrets on write and decrypts them transparently on read — a
   * subscription registers PLAINTEXT credentials and dispatch reads them back in
   * the clear (no manual decrypt). `username` is NOT encrypted: it is an
   * identifier, not a secret. Default
   * `{ condition: { purpose: "pylon:kek" } }` — the same bootstrap KEK as kryptos;
   * override it (e.g. its own `purpose`) for a separate blast radius. Same
   * `{ kryptos?, condition? }` descriptor as every other key surface;
   * `encryption` (the AEAD) is ignored on this path.
   */
  encryption?: PylonEncKey;
  maxErrors?: number;
};

export type PylonResponseCacheSettings = {
  enabled: boolean;
};

export type PylonRateLimitStrategy = "fixed" | "sliding" | "token-bucket";

export type PylonRateLimitSettings = {
  enabled: boolean;
  strategy?: PylonRateLimitStrategy;
  /**
   * The deployment-wide window and ceiling. Both are optional together: a
   * deployment may enable rate limiting for mounts that state their own limits
   * without imposing a global one, in which case no global mount is installed.
   */
  window?: ReadableTime | number;
  max?: number;
  key?: (ctx: any) => string;
  skip?: (ctx: any) => boolean;
};

export type PylonAuditSettings = {
  enabled: boolean;
  sanitise?: (body: unknown) => unknown;
  skip?: (ctx: any) => boolean;
  entities?: Array<Constructor<IEntity>>;
};

export type PylonRoomsSettings = {
  presence?: boolean;
};

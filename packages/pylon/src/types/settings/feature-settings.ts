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

export type PylonRateLimitStrategy = "fixed" | "sliding" | "token-bucket";

/**
 * The deployment's rate-limit policy. ⚠ Its PRESENCE is the switch — there is no
 * `enabled` beside it, because a flag next to a populated policy either restates
 * what the policy already says or contradicts it. Omit the block to leave rate
 * limiting off; every `useRateLimit` mount then passes through.
 *
 * Pylon mounts nothing on its own: a global limiter is an explicit
 * `useRateLimit()` in the routes' root `_middleware.ts` (or `socket.middleware`
 * / the listeners' root `_middleware.ts`).
 */
export type PylonRateLimitSettings = {
  strategy?: PylonRateLimitStrategy;
  /**
   * The deployment-wide window and ceiling. Both are optional together: a bare
   * `rateLimit: {}` turns the feature on for mounts that state their own limits
   * without imposing a global one.
   */
  window?: ReadableTime | number;
  max?: number;
  key?: (ctx: any) => string;
  skip?: (ctx: any) => boolean;
};

/**
 * The deployment's audit policy. ⚠ Its PRESENCE is the switch, on the same terms
 * as {@link PylonRateLimitSettings} — omit the block to leave auditing off, and
 * every `useAuditLog` mount passes through.
 */
export type PylonAuditSettings = {
  sanitise?: (body: unknown) => unknown;
  skip?: (ctx: any) => boolean;
  entities?: Array<Constructor<IEntity>>;
};

export type PylonRoomsSettings = {
  presence?: boolean;
};

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
 * The deployment's rate-limit policy — the limits every mount that states none
 * of its own inherits, written once.
 *
 * ⚠ It is NOT a switch. MOUNTING `useRateLimit` is what turns rate limiting on,
 * so omitting this block does not turn a mount off: a mount stating its own
 * `window` and `max` limits exactly as it says, and one stating neither throws
 * `rate_limit_not_bounded`. A limiter in a chain always limits or says why it
 * cannot.
 *
 * Pylon mounts nothing on its own: a global limiter is an explicit
 * `useRateLimit()` in the routes' root `_middleware.ts` (or `socket.middleware`
 * / the listeners' root `_middleware.ts`).
 */
export type PylonRateLimitSettings = {
  strategy?: PylonRateLimitStrategy;
  /**
   * The deployment-wide window and ceiling, imposed on every mount that states
   * none. Both are optional together: a bare `rateLimit: {}` imposes nothing and
   * is indistinguishable from omitting the block.
   */
  window?: ReadableTime | number;
  max?: number;
  key?: (ctx: any) => string;
  skip?: (ctx: any) => boolean;
};

/**
 * The deployment's audit policy. ⚠ Unlike {@link PylonRateLimitSettings}, its
 * PRESENCE is the switch — omit the block to leave auditing off, and every
 * `useAuditLog` mount passes through. The block is wiring as well as policy: it
 * is what subscribes the consumer that writes a published record to
 * `RequestAuditLog`, so a mount without it would publish into a bus nobody reads.
 */
export type PylonAuditSettings = {
  sanitise?: (body: unknown) => unknown;
  skip?: (ctx: any) => boolean;
  entities?: Array<Constructor<IEntity>>;
};

export type PylonRoomsSettings = {
  presence?: boolean;
};

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
   * transparently on read. Default `{ condition: { purpose: "pylon:kek" } }` —
   * the bootstrap key-encryption-key. Same `{ kryptos?, condition? }` descriptor
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

export type PylonCacheSettings = {
  enabled: boolean;
  kv?: IProteusSource;
};

/**
 * The RFC 7662 introspection cache — pylon as a RESOURCE SERVER, which is why it
 * sits beside `cache`/`rateLimit` rather than under `auth` (pylon as a relying
 * party). Absent means OFF: RFC 7662 §5 expects a deployment sensitive enough to
 * refuse any caching to be able to say so, and saying nothing is saying no.
 *
 * ⚠ `ttl` IS the revocation window (RFC 7662 §5) and is measured in SECONDS, for
 * `active: false` answers as much as for live ones. Default `10 seconds`; a
 * single mount may shorten it, or opt out entirely, via
 * `createAccessTokenMiddleware({ cache })`.
 */
export type PylonIntrospectionSettings = {
  enabled: boolean;
  kv?: IProteusSource;
  ttl?: ReadableTime;
  /**
   * The at-rest KEK selector staged onto `CachedIntrospection.payload` before the
   * source sets up. The cached answer is the claim set of a LIVE credential —
   * subject, scope, delegation — sitting in shared storage, so proteus seals it
   * on write and opens it transparently on read. Default
   * `{ condition: { purpose: "pylon:kek" } }` — the same bootstrap KEK as kryptos
   * and webhook; override it (e.g. its own `purpose`) for a separate blast
   * radius. Same `{ kryptos?, condition? }` descriptor as every other key
   * surface; `encryption` (the AEAD) is ignored on this path.
   */
  encryption?: PylonEncKey;
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

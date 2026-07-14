import type { ReadableTime } from "@lindorm/date";
import type { IIrisSource } from "@lindorm/iris";
import type { IEntity, IProteusSource } from "@lindorm/proteus";
import type { Constructor, Dict, Priority } from "@lindorm/types";
import type { PylonCommonContext } from "./context-common.js";
import type { PylonHttpContext } from "./context-http.js";
import type { PylonEncKey } from "./keys.js";
import type { PylonSessionConfig } from "./session.js";

// handlers

export type PylonHttpCallback<C extends PylonHttpContext = PylonHttpContext> = (
  ctx: C,
) => Promise<void>;

export type PylonQueueCallback<C extends PylonCommonContext = PylonCommonContext> = (
  ctx: C,
  event: string,
  payload: Dict,
  priority: Priority,
) => Promise<void>;

export type PylonWebhookCallback<C extends PylonCommonContext = PylonCommonContext> = (
  ctx: C,
  event: string,
  payload: Dict,
) => Promise<void>;

// feature options

export type PylonSessionOptions = PylonSessionConfig & {
  enabled: boolean;
  kv?: IProteusSource;
};

export type PylonKryptosOptions = {
  enabled: boolean;
  db?: IProteusSource;
};

export type PylonQueueOptions = {
  enabled: boolean;
  bus?: IIrisSource;
};

export type PylonWebhookOptions = {
  enabled: boolean;
  db?: IProteusSource;
  bus?: IIrisSource;
  /**
   * The key that opens a subscription's stored `clientSecret`.
   *
   * The same `{ kryptos?, predicate? }` descriptor as every other key surface —
   * but a DECRYPT descriptor: the stored secret is tokenised ciphertext, so it
   * names its own key and selection is driven by that id, never by this option.
   * `predicate` is therefore a CHECK on the key the ciphertext names (a
   * deployment that seals webhook secrets with one class of key can refuse every
   * other), and `kryptos` answers only for its OWN kid — a secret sealed by a key
   * that never reached the vault. A `kryptos` naming a different key than the
   * ciphertext is a caller error, not a silent override; otherwise a rotated-in
   * key would shadow every secret the old one sealed.
   */
  encryptionKey?: PylonEncKey;
  maxErrors?: number;
};

export type PylonCacheOptions = {
  enabled: boolean;
  kv?: IProteusSource;
};

export type PylonRateLimitOptions = {
  enabled: boolean;
  kv?: IProteusSource;
  strategy?: "fixed" | "sliding" | "token-bucket";
  window?: ReadableTime | number;
  max?: number;
  key?: (ctx: any) => string;
  skip?: (ctx: any) => boolean;
};

export type PylonAuditOptions = {
  enabled: boolean;
  db?: IProteusSource;
  bus?: IIrisSource;
  sanitise?: (body: unknown) => unknown;
  skip?: (ctx: any) => boolean;
  entities?: Array<Constructor<IEntity>>;
};

export type PylonRoomsOptions = {
  presence?: boolean;
  kv?: IProteusSource;
};

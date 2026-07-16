import type { ReadableTime } from "@lindorm/date";
import type { IIrisSource } from "@lindorm/iris";
import type { IEntity, IProteusSource } from "@lindorm/proteus";
import type { Constructor } from "@lindorm/types";
import type { PylonEncKey } from "./keys.js";

export type PylonKryptosSettings = {
  enabled: boolean;
  db?: IProteusSource;
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
   * The webhook feature's flat key selector. Only `encryption` applies: the key
   * that opens a subscription's stored `clientSecret`.
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

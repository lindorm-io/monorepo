import type { ReadableTime } from "@lindorm/date";
import type { IIrisSource } from "@lindorm/iris";
import type { IKryptos } from "@lindorm/kryptos";
import type { IEntity, IProteusSource } from "@lindorm/proteus";
import type { Constructor, Dict, Priority } from "@lindorm/types";
import type { PylonCommonContext } from "./context-common.js";
import type { PylonHttpContext } from "./context-http.js";
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
  proteus?: IProteusSource;
};

export type PylonKryptosOptions = {
  enabled: boolean;
  proteus?: IProteusSource;
};

export type PylonQueueOptions = {
  enabled: boolean;
  iris?: IIrisSource;
};

export type PylonWebhookOptions = {
  enabled: boolean;
  proteus?: IProteusSource;
  iris?: IIrisSource;
  encryptionKey?: IKryptos;
  maxErrors?: number;
};

export type PylonRateLimitOptions = {
  enabled: boolean;
  proteus?: IProteusSource;
  strategy?: "fixed" | "sliding" | "token-bucket";
  window?: ReadableTime | number;
  max?: number;
  key?: (ctx: any) => string;
  skip?: (ctx: any) => boolean;
};

export type PylonAuditOptions = {
  enabled: boolean;
  proteus?: IProteusSource;
  iris?: IIrisSource;
  actor: (ctx: any) => string;
  sanitise?: (body: unknown) => unknown;
  skip?: (ctx: any) => boolean;
  entities?: Array<Constructor<IEntity>>;
};

export type PylonRoomsOptions = {
  presence?: boolean;
  proteus?: IProteusSource;
};

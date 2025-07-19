import { Priority } from "@lindorm/types";
import { IKryptos } from "@lindorm/kryptos";
import { Dict } from "@lindorm/types";
import { CreateLindormWorkerOptions } from "@lindorm/worker";
import { IPylonSessionStore } from "../interfaces/PylonSessionStore";
import { PylonCommonContext } from "./context-common";
import { PylonHttpContext } from "./context-http";
import { PylonEntitySourceName, PylonMessageSourceName } from "./sources";
import { QueueJobHandler } from "./types";
import { PylonSessionConfig } from "./session";

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

// queue options

export type PylonCustomQueueOptions<C extends PylonCommonContext = PylonCommonContext> = {
  use: "custom";
  custom: PylonQueueCallback<C>;
};

export type PylonMessageQueueOptions = {
  use: "message";
  handlers: Dict<QueueJobHandler>;
  source: PylonMessageSourceName;
};

export type PylonEntityQueueOptions = {
  use: "entity";
  handlers: Dict<QueueJobHandler>;
  source: PylonEntitySourceName;
  worker?: CreateLindormWorkerOptions;
};

export type PylonQueueOptions<C extends PylonCommonContext = PylonCommonContext> =
  | PylonCustomQueueOptions<C>
  | PylonMessageQueueOptions
  | PylonEntityQueueOptions;

// session options

export type PylonCustomSessionOptions<C extends PylonHttpContext = PylonHttpContext> =
  PylonSessionConfig & {
    use: "custom";
    custom: IPylonSessionStore<C>;
  };

export type PylonCookieSessionOptions = PylonSessionConfig & {
  use: "cookie";
};

export type PylonStoredSessionOptions = PylonSessionConfig & {
  use: "stored";
  source: PylonEntitySourceName;
};

export type PylonSessionOptions<C extends PylonHttpContext = PylonHttpContext> =
  | PylonCustomSessionOptions<C>
  | PylonCookieSessionOptions
  | PylonStoredSessionOptions;

// webhook options

export type PylonCustomWebhookOptions<C extends PylonCommonContext = PylonCommonContext> =
  {
    use: "custom";
    custom: PylonWebhookCallback<C>;
  };

export type PylonMessageWebhookOptions = {
  use: "message";
  encryptionKey?: IKryptos;
  source: PylonMessageSourceName;
  subscriptions: PylonEntitySourceName;
};

export type PylonEntityWebhookOptions = {
  use: "entity";
  encryptionKey?: IKryptos;
  source: PylonEntitySourceName;
  subscriptions: PylonEntitySourceName;
  worker?: CreateLindormWorkerOptions;
};

export type PylonWebhookOptions<C extends PylonCommonContext = PylonCommonContext> =
  | PylonCustomWebhookOptions<C>
  | PylonMessageWebhookOptions
  | PylonEntityWebhookOptions;

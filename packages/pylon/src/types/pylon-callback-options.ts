import { IProteusSource } from "@lindorm/proteus";
import { Dict, Priority } from "@lindorm/types";
import { IPylonSessionStore } from "../interfaces/PylonSessionStore";
import { PylonCommonContext } from "./context-common";
import { PylonHttpContext } from "./context-http";
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
  proteus?: IProteusSource;
};

export type PylonSessionOptions<C extends PylonHttpContext = PylonHttpContext> =
  | PylonCustomSessionOptions<C>
  | PylonCookieSessionOptions
  | PylonStoredSessionOptions;

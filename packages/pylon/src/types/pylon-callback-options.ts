import { IIrisSource } from "@lindorm/iris";
import { IProteusSource } from "@lindorm/proteus";
import { Dict, Priority } from "@lindorm/types";
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
};

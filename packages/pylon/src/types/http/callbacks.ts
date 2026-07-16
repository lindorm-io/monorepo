import type { Dict, Priority } from "@lindorm/types";
import type { PylonCommonContext } from "../context/context-common.js";
import type { PylonHttpContext } from "../context/context-http.js";

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

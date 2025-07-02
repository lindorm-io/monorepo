import { Priority } from "@lindorm/enums";
import { Dict } from "@lindorm/types";
import { PylonHttpContext } from "./pylon-http-context";

export type OptionsHandler<C extends PylonHttpContext = PylonHttpContext> = (
  ctx: C,
) => Promise<void>;

export type OptionsQueueHandler<C extends PylonHttpContext = PylonHttpContext> = (
  ctx: C,
  name: string,
  data: Dict,
  priority: Priority,
) => Promise<void>;

export type OptionsWebhookHandler<C extends PylonHttpContext = PylonHttpContext> = (
  ctx: C,
  event: string,
  payload: Dict,
) => Promise<void>;

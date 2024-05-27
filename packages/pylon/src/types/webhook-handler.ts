import { PylonHttpContext } from "./pylon-context";

export type WebhookHandler<C extends PylonHttpContext = PylonHttpContext> = (
  ctx: C,
) => Promise<string | void>;

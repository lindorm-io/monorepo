import { PylonHttpContext } from "./pylon-http-context";

export type WebhookHandler<C extends PylonHttpContext = PylonHttpContext> = (
  ctx: C,
) => Promise<string | void>;

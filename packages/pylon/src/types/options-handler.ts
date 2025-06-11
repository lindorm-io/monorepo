import { PylonHttpContext } from "./pylon-http-context";

export type OptionsHandler<C extends PylonHttpContext = PylonHttpContext> = (
  ctx: C,
) => Promise<void>;

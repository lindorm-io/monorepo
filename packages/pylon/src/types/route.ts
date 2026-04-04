import { PylonHttpMiddleware } from "./context-http";
import { PylonSocketContext, PylonSocketMiddleware } from "./context-socket";

export type PylonHttpRoute = PylonHttpMiddleware | Array<PylonHttpMiddleware>;
export type PylonSocketRoute<Payload = any> =
  | PylonSocketMiddleware<PylonSocketContext<Payload>>
  | Array<PylonSocketMiddleware<PylonSocketContext<Payload>>>;

import type { PylonHttpMiddleware } from "./context-http.js";
import type { PylonSocketContext, PylonSocketMiddleware } from "./context-socket.js";

export type PylonHttpRoute = PylonHttpMiddleware | Array<PylonHttpMiddleware>;
export type PylonSocketRoute<Payload = any> =
  | PylonSocketMiddleware<PylonSocketContext<Payload>>
  | Array<PylonSocketMiddleware<PylonSocketContext<Payload>>>;

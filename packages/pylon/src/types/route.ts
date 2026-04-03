import { PylonHttpMiddleware } from "./context-http";
import { PylonSocketMiddleware } from "./context-socket";

export type PylonHttpRoute = PylonHttpMiddleware | Array<PylonHttpMiddleware>;
export type PylonSocketRoute = PylonSocketMiddleware | Array<PylonSocketMiddleware>;

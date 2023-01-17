import { Context } from "./context";
import { Middleware as Mw } from "@lindorm-io/middleware";

export type Middleware = Mw<Context>;

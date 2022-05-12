import { Environment } from "../enum";
import { Logger } from "@lindorm-io/winston";
import { Middleware } from "./koa";
import { IntervalWorker } from "../class";
import { KoaContext } from "./context";

export type HealthCallback<Context extends KoaContext> = (ctx: Context) => Promise<void>;

export type HeartbeatCallback<Context extends KoaContext> = (ctx: Context) => Promise<void>;

export type SetupCallback = () => Promise<void>;

export interface KoaAppOptions<Context extends KoaContext> {
  // required
  host: string;
  logger: Logger;
  port: number;

  // optional
  domain?: string;
  environment?: Environment;
  keys?: Array<string>;
  middleware?: Array<Middleware<any>>;
  workers?: Array<IntervalWorker>;

  // functions
  health?: HealthCallback<Context>;
  heartbeat?: HeartbeatCallback<Context>;
  setup?: SetupCallback;
}

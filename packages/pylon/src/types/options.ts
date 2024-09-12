import { IAmphora } from "@lindorm/amphora";
import { Environment } from "@lindorm/enums";
import { ILogger } from "@lindorm/logger";
import { ILindormWorker } from "@lindorm/worker";
import Redis from "ioredis";
import { ServerOptions as SocketOptions } from "socket.io";
import { PylonRouter } from "../classes";
import { PylonListener } from "../classes/PylonListener";
import { OpenIdConfigurationOptions } from "./open-id-configuration";
import { ParseBodyOptions } from "./parse-body";
import { PylonHttpContext, PylonHttpMiddleware } from "./pylon-context";
import { PylonEventContext, PylonEventMiddleware } from "./pylon-event-context";
import { PylonSetup, PylonTeardown } from "./setup";

type HttpRouters<C extends PylonHttpContext> = { path: string; router: PylonRouter<C> };

export type PylonOptions<
  C extends PylonHttpContext = PylonHttpContext,
  S extends PylonEventContext = PylonEventContext,
> = {
  amphora: IAmphora;
  logger: ILogger;

  domain?: string;
  environment?: Environment;
  httpMiddleware?: Array<PylonHttpMiddleware<C>>;
  httpRouters?: string | Array<HttpRouters<C>>;
  issuer?: string;
  keys?: Array<string>;
  name?: string;
  openIdConfiguration?: Partial<OpenIdConfigurationOptions>;
  parseBody?: ParseBodyOptions;
  port?: number;
  setup?: PylonSetup;
  socketListeners?: string | Array<PylonListener<S>>;
  socketMiddleware?: Array<PylonEventMiddleware<S>>;
  socketOptions?: Partial<SocketOptions>;
  socketRedis?: Redis;
  teardown?: PylonTeardown;
  version?: string;
  workers?: Array<ILindormWorker>;
};

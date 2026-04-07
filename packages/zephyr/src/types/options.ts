import { ILogger } from "@lindorm/logger";
import type { DeepPartial, Environment } from "@lindorm/types";
import type { ManagerOptions, SocketOptions } from "socket.io-client";
import type { ZephyrMiddleware } from "./context";

export type ZephyrAuth = {
  bearer: string | (() => string | Promise<string>);
};

export type ZephyrOptions = {
  url: string;
  alias?: string;
  auth?: ZephyrAuth;
  autoConnect?: boolean;
  environment?: Environment;
  logger?: ILogger;
  middleware?: Array<ZephyrMiddleware>;
  namespace?: string;
  socketOptions?: DeepPartial<
    Omit<ManagerOptions, "autoConnect" | "timeout"> & Omit<SocketOptions, "auth">
  >;
  timeout?: number;
};

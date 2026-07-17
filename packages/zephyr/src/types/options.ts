import type { ILogger } from "@lindorm/logger";
import type { DeepPartial, Environment } from "@lindorm/types";
import type { ManagerOptions, SocketOptions } from "socket.io-client";
import type { ZephyrAuthStrategy } from "../auth/zephyr-auth-strategy.js";
import type { ZephyrMiddleware } from "./context.js";

export type ZephyrAdvancedSettings = DeepPartial<
  Omit<ManagerOptions, "autoConnect" | "timeout"> & Omit<SocketOptions, "auth">
>;

export type ZephyrSettings = {
  url: string;
  alias?: string;
  auth?: ZephyrAuthStrategy;
  autoConnect?: boolean;
  autoRefreshOnExpiry?: boolean;
  environment?: Environment;
  logger?: ILogger;
  middleware?: Array<ZephyrMiddleware>;
  namespace?: string;
  socketOptions?: ZephyrAdvancedSettings;
  timeout?: number;
};

import { Amphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { Logger, LogLevel } from "@lindorm/logger";
import { join } from "path";
import { Environment, Pylon } from "../src";

const logger = new Logger({
  level: LogLevel.Silly,
  readable: true,
});

const amphora = new Amphora({
  issuer: "http://test.lindorm.io",
  logger,
});

amphora.add(
  KryptosKit.make.auto({
    algorithm: "ES256",
    issuer: "http://test.lindorm.io",
  }),
);

export const EXAMPLE_PYLON = new Pylon({
  amphora,
  logger,

  environment: Environment.Test,
  httpRouters: join(__dirname, "routers"),
  issuer: "http://test.lindorm.io",
  name: "@lindorm/pylon",
  port: 3000,
  socketListeners: join(__dirname, "listeners"),
  setup: async (): Promise<void> => {
    await amphora.setup();
  },
  version: "0.0.0",
});

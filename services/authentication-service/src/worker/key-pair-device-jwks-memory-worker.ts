import { configuration } from "../server/configuration";
import { keyPairJwksMemoryWorker } from "@lindorm-io/koa-keystore";
import { memoryDatabase } from "../instance";
import { logger } from "../server/logger";

export const keyPairDeviceJwksMemoryWorker = keyPairJwksMemoryWorker({
  host: configuration.services.device_service.host,
  port: configuration.services.device_service.port,
  clientName: "device",
  memoryDatabase,
  retry: { maximumAttempts: 30 },
  logger,
});

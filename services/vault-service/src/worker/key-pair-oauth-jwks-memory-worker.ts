import { configuration } from "../server/configuration";
import { keyPairJwksMemoryWorker } from "@lindorm-io/koa-keystore";
import { logger } from "../server/logger";
import { memoryDatabase } from "../instance";

export const keyPairOauthJwksMemoryWorker = keyPairJwksMemoryWorker({
  host: configuration.services.oauth_service.host,
  port: configuration.services.oauth_service.port,
  clientName: "oauth",
  logger,
  memoryDatabase,
  retry: { maximumAttempts: 30 },
});

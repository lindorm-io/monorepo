import { configuration } from "../server/configuration";
import { keyPairRotationWorker as _keyPairRotationWorker } from "@lindorm-io/koa-keystore";
import { mongoConnection } from "../instance";
import { logger } from "../server/logger";

export const keyPairRotationWorker = _keyPairRotationWorker({
  mongoConnection,
  origin: configuration.server.issuer,
  logger,
});

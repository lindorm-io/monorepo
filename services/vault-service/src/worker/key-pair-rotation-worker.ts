import { KeyType } from "@lindorm-io/key-pair";
import { configuration } from "../server/configuration";
import { keyPairRotationWorker } from "@lindorm-io/koa-keystore";
import { mongoConnection } from "../instance";
import { logger } from "../server/logger";

export const keyPairEcRotationWorker = keyPairRotationWorker({
  keyType: KeyType.EC,
  mongoConnection,
  origin: configuration.server.issuer,
  logger,
});

export const keyPairRsaRotationWorker = keyPairRotationWorker({
  keyType: KeyType.RSA,
  mongoConnection,
  origin: configuration.server.issuer,
  logger,
});

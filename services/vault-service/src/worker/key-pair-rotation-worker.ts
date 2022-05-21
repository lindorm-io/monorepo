import { keyPairRotationWorker } from "@lindorm-io/koa-keystore";
import { mongoConnection } from "../instance";
import { winston } from "../server/logger";
import { KeyType } from "@lindorm-io/key-pair";

export const keyPairEcRotationWorker = keyPairRotationWorker({
  keyType: KeyType.EC,
  mongoConnection,
  winston,
});

export const keyPairRsaRotationWorker = keyPairRotationWorker({
  keyType: KeyType.RSA,
  mongoConnection,
  winston,
});

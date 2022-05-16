import { keyPairRotationWorker as _keyPairRotationWorker } from "@lindorm-io/koa-keystore";
import { mongoConnection } from "../instance";
import { winston } from "../server/logger";

export const keyPairRotationWorker = _keyPairRotationWorker({
  mongoConnection,
  winston,
});

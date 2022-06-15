import { IntervalWorker } from "@lindorm-io/koa";
import { configuration } from "./configuration";
import {
  keyPairCleanupWorker,
  keyPairMongoCacheWorker,
  keyPairOauthJwksWorker,
  keyPairRotationWorker,
} from "../worker";

export const workers: Array<IntervalWorker> = [];

if (configuration.server.workers) {
  workers.push(keyPairCleanupWorker);
  workers.push(keyPairMongoCacheWorker);
  workers.push(keyPairOauthJwksWorker);
  workers.push(keyPairRotationWorker);
}

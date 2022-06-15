import { IntervalWorker } from "@lindorm-io/koa";
import { configuration } from "./configuration";
import {
  keyPairCleanupWorker,
  keyPairEcRotationWorker,
  keyPairMongoCacheWorker,
  keyPairOauthJwksWorker,
  keyPairRsaRotationWorker,
} from "../worker";

export const workers: Array<IntervalWorker> = [];

if (configuration.server.workers) {
  workers.push(keyPairCleanupWorker);
  workers.push(keyPairEcRotationWorker);
  workers.push(keyPairMongoCacheWorker);
  workers.push(keyPairOauthJwksWorker);
  workers.push(keyPairRsaRotationWorker);
}
